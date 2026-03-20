# CLAUDE.md — web-client

Browser-based React/Vite SPA for LLM-Tor. Mirrors the desktop client's UI but runs entirely in the browser — **no Tor** (requests go clearnet), no Electron, no native binaries. RSA blind tokens are handled with the Web Crypto API.

## Commands

```bash
# Install
npm install

# Dev server (http://localhost:5173)
npm run dev

# Type-check
npm run typecheck

# Lint
npm run lint

# Format
npm run format

# Production build → dist/
npm run build
```

No automated tests.

## Architecture

### Directory layout

```
src/
  api/           # All backend communication (no direct fetch calls elsewhere)
    llmproxy.ts  # LLM request + abuse token bundling
    rsa.ts       # Blind RSA token pool (localStorage, Web Crypto)
    abuse-token.ts
    feedback.ts
  components/    # Shared UI components (ChatMessage, Sidebar, modals, …)
  contexts/      # React contexts: User, Theme, Settings, Notification, Error
  hooks/         # useChats — persists chat history in localStorage
  pages/         # AuthCallback (OAuth redirect handler)
  types/
    config.ts    # Per-model RSA public keys (hardcoded, same as desktop)
    models.ts    # MODEL_IDS / AVAILABLE_MODEL_IDS (single source of truth)
    index.ts     # Shared TS types
  config.ts      # SERVER_URL, WEB_APP_URL, DESKTOP_DOWNLOAD_URL
  App.tsx        # Router + modal orchestration
```

### Key configuration (`src/config.ts`)

- `SERVER_URL`: `http://localhost:8080` (dev) / `https://api.llmtor.com` (prod)
- Override with `VITE_API_BASE_URL` env var.

### Token pool (`src/api/rsa.ts`)

- Stored in **localStorage** under `_tokenPool.<modelName>` (same key scheme as desktop's electron-store).
- Pool target: 5 tokens per model; refill triggered when ≤ 2 remain.
- Blind RSA via `@cloudflare/blindrsa-ts` + `crypto.subtle` (Web Crypto).
- Helpers: `uint8ArrayToBase64` / `base64ToUint8Array`.

### LLM proxy (`src/api/llmproxy.ts`)

- Sends to `POST /api/v1/llm-proxy` with `credentials: 'include'` (cookie auth).
- Bundles per-request token + both abuse tokens in `extra_body.llmmask`.
- Response payload: `proxy_response` is base64-encoded bytes → decoded → parsed as `ChatCompletion`.

### Auth

- Cookie-based session (no localStorage tokens for identity).
- OAuth callback handled by `src/pages/AuthCallback.tsx` — Google OAuth redirects here after sign-in.
- Auth state lives in `UserContext`.

### Abuse tokens (`src/api/abuse-token.ts`)

- Same blind-signature scheme as desktop client.
- Stored in localStorage; backup encryption uses `crypto.subtle` (PBKDF2 + AES-GCM).
- First-time setup: `AbuseTokenSetupModal` (in `src/components/`).
- Monthly renewal: `TransientTokenExpiredModal`.

### Contexts

| Context | Purpose |
|---|---|
| `UserContext` | Authenticated user profile, sign-in/out |
| `ThemeContext` | Light/dark mode, persisted in localStorage |
| `SettingsContext` | Model selection, other user preferences |
| `NotificationContext` | Toast notifications |
| `ErrorContext` | Global error display |

### Differences from desktop client

| Feature | Web client | Desktop client |
|---|---|---|
| Network routing | Clearnet (no Tor) | Tor SOCKS5 (port 9050) |
| Token storage | `localStorage` | `electron-store` |
| Crypto | `crypto.subtle` (Web Crypto) | Node `crypto` + `@cloudflare/blindrsa-ts` |
| Auth capture | OAuth redirect to `AuthCallback` page | Local HTTP server on port 5139 |
| IPC | N/A | Electron IPC via preload |
