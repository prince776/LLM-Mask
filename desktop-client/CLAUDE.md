# CLAUDE.md — desktop-client

Electron + React desktop app for LLM-Tor. Routes all LLM requests through a bundled Tor binary (SOCKS5) and uses RSA blind signatures for unlinkability. Auth tokens and abuse tokens are managed in the main process via `electron-store`.

## Commands

```bash
# Install
npm install

# Development (hot reload)
npm run dev

# Type checking (run both)
npm run typecheck:node
npm run typecheck:web

# Lint
npm run lint

# Format
npm run format

# Build without packaging
npm run build:unpack

# Platform-specific packaged builds (handles Tor binary staging)
./dist.sh mac arm      # macOS Apple Silicon
./dist.sh mac x64      # macOS Intel
./dist.sh linux x64    # Linux x64
./dist.sh windows x64  # Windows x64
```

No automated tests.

## Architecture

### Process structure

Three separate build targets compiled by `electron-vite`:

- **`src/main/`** — Node.js main process. All privileged operations live here.
- **`src/preload/`** — Bridges main ↔ renderer via `contextBridge`.
- **`src/renderer/src/`** — React 19 SPA (sandboxed, no Node access).
- **`src/types/`** — Shared TypeScript types used across all three layers.

### IPC channels

Renderer → main (`ipcRenderer.invoke` / `ipcMain.handle`):

| Channel | Description |
|---|---|
| `generate-token` | Fetch (or refill) a blind-signed token for a model |
| `llm-proxy` | Send a Tor-routed LLM request with token + abuse tokens |
| `start-auth` | Open OAuth popup window |
| `start-purchase` | Open Paddle purchase window |
| `setup-abuse-tokens` | First-time permanent + transient abuse token issuance |
| `refresh-transient-abuse-token` | Monthly renewal of transient abuse token |
| `restore-abuse-token-backup` | Restore from local file or server |
| `get-abuse-token-status` | Check current abuse token state |

Main → renderer events: `tor-setup-begin`, `tor-ready`, `auth-window-closed`.

### Key source files

| File | Role |
|---|---|
| `src/main/index.ts` | App lifecycle, window management, all IPC handlers, OAuth capture server (port 5139) |
| `src/main/torproxy.ts` | Spawn + monitor bundled Tor binary; fail fast if bootstrap times out |
| `src/main/llmproxy.ts` | Tor-routed LLM requests (SOCKS5 via `net.request`, dedicated `persist:tor-session` partition) |
| `src/main/rsa.ts` | Blind RSA token generation (`@cloudflare/blindrsa-ts`); token pool in `electron-store` |
| `src/main/abuse-token.ts` | Abuse token generation, PBKDF2/AES-GCM backup encryption, electron-store persistence, server backup upload/download |
| `src/main/local-store.ts` | `electron-store` singleton (`getStore()`) |
| `src/main/utils.ts` | `getCookieHeader()` and other shared utilities |
| `src/types/config.ts` | `SERVER_URL`, per-model RSA public keys, `AbuseTokenPublicKeys` |
| `src/types/models.ts` | `MODEL_IDS` / `AVAILABLE_MODEL_IDS` — single source of truth |

### Token pool (`src/main/rsa.ts`)

- Stored in `electron-store` under `_tokenPool.<modelName>`.
- Pool target: 5 tokens per model; background refill triggers when ≤ 2 remain.
- Helpers: `uint8ArrayToBase64` / `base64ToUint8Array`.

### Tor integration (`src/main/torproxy.ts`)

- Binary location: `prod-deps/tor-dist/<platform-arch>/tor/tor[.exe]`
- All platforms' binaries in `prod-deps-all/`; `dist.sh` copies the right one before packaging.
- Startup: `startTorProxy()` spawns binary → `waitForTor()` polls stdout for `"Bootstrapped 100%"` (30 s timeout).
- App exits with code 1 if Tor fails to bootstrap.
- LLM requests use `doTorProxiedRequest()` via `socks5://127.0.0.1:9050`.

### Auth flow

1. `start-auth` IPC → main opens `authWindow` → `SERVER_URL/api/v1/users/signin?redirect=http://127.0.0.1:5139/callback`
2. Local HTTP server on port 5139 captures OAuth callback.
3. Session cookies stored in `persist:app` partition.
4. Main window reloads; `auth-window-closed` event triggers renderer to re-fetch user profile.

### Abuse token system (`src/main/abuse-token.ts`)

Every anonymous LLM request includes two long-lived blind-signed abuse tokens alongside the per-request token:

| Token | Size | Validity |
|---|---|---|
| Permanent (`A_p`) | 48 random bytes | Account lifetime |
| Transient (`A_t`) | 44 random bytes + 4-byte big-endian epoch | One calendar month |

- Epoch = `year × 12 + month` (1-indexed).
- Backup encryption: PBKDF2(SHA-256, 600k iterations) → AES-256-GCM; format: `base64(salt‖IV‖ciphertext)`.
- Always exported as a local `.llmmaskbak` file; server sync is opt-in.
- Restoration: from local file (primary) or server (only if previously synced).

### Startup sequence

App starts → Tor initializes (`tor-setup-begin` event) → tokens prefetched for all models → Tor ready (`tor-ready` event) → UI shown.

### Key configuration (`src/types/config.ts`)

- `SERVER_URL`: `http://localhost:8080` (dev) / production URL in built app.
- Per-model RSA public keys and `AbuseTokenPublicKeys` are hardcoded (fetched from server at build/deploy time).
