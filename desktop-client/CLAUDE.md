# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**llmtor** — an Electron desktop app that routes LLM API requests through the Tor network for anonymous AI interactions. It uses RSA Blind Signatures (via `@cloudflare/blindrsa-ts`) so the backend server cannot link a token to the user who requested it, then proxies LLM calls (OpenAI-compatible API) over Tor.

## Commands

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Type checking
npm run typecheck

# Linting
npm run lint

# Format
npm run format

# Build (no packaging)
npm run build

# Platform-specific packaged builds (handles tor binary staging automatically)
./dist.sh mac arm      # macOS Apple Silicon
./dist.sh mac x64      # macOS Intel
./dist.sh linux x64    # Linux x64
./dist.sh windows x64  # Windows x64
```

There are no automated tests in this project.

## Architecture

### Process Structure (Electron)

Three separate build targets compiled by `electron-vite`:

- **`src/main/`** — Node.js main process. Owns all privileged operations.
- **`src/preload/`** — Preload script. Bridges main ↔ renderer via `contextBridge`.
- **`src/renderer/src/`** — React UI (runs in sandboxed browser context, no Node access).
- **`src/types/`** — Shared TypeScript types used by all three layers.

### IPC Flow

The renderer never calls Node APIs directly. All privileged operations go through:

1. `window.api.<method>()` (defined in `src/preload/index.ts`)
2. `ipcRenderer.invoke(channel, data)` → crosses the process boundary
3. `ipcMain.handle(channel, handler)` in `src/main/index.ts`

Key IPC channels: `generate-token`, `llm-proxy`, `start-auth`, `start-purchase`, `get-tor-status`.
Main→renderer events: `tor-setup-begin`, `tor-ready`, `auth-window-closed`.

### Privacy Mechanism (Blind Signatures)

When a user sends a message:
1. Renderer calls `generate-token` IPC → main process
2. Main checks the token pool (`electron-store`, key `_tokenPool.<modelName>`) — pool size target is 5
3. If pool has tokens, one is consumed; if low, background prefetch is triggered
4. A token is a UUID blinded with the model's RSA public key (in `src/types/config.ts`), sent to the server for signing, then unblinded — the server signs without seeing the actual token
5. Token + signed token are sent with the LLM request to `SERVER_URL/api/v1/llm-proxy`
6. The LLM request travels over Tor via a custom `fetch` implementation that uses `net.request` through a SOCKS5 proxy on port 9050

### Tor Integration

- Tor binary bundled in `prod-deps/tor-dist/<platform-arch>/tor/tor[.exe]`
- `prod-deps-all/` holds binaries for all platforms; `dist.sh` copies the right one to `prod-deps/` before packaging
- On app start: `startTorProxy()` spawns the binary, `waitForTor()` polls stdout for `"Bootstrapped 100%"` with a 30-second timeout
- All LLM proxy calls use `doTorProxiedRequest()` which routes through `socks5://127.0.0.1:9050` using a dedicated Electron session partition (`persist:tor-session`)
- The app exits with code 1 if Tor fails to bootstrap

### Auth Flow

Auth uses a popup BrowserWindow + local HTTP server on port 5139:
1. Main opens `authWindow` → loads `SERVER_URL/api/v1/users/signin?redirect=http://127.0.0.1:5139/callback`
2. Server redirects back to local server after sign-in
3. Cookies are stored in the shared `persist:app` partition
4. Main window reloads; `auth-window-closed` IPC event triggers renderer to refetch user profile

### Key Configuration

- **`src/types/config.ts`**: `SERVER_URL` (default `http://localhost:8080`) and per-model RSA public keys used for blind signature verification
- **`src/types/models.ts`**: `MODEL_IDS` and `AVAILABLE_MODEL_IDS` — single source of truth for supported models
- Chat history persists in `localStorage` (renderer); token pool persists in `electron-store` (main)
