# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**llmmask** (protocol name: **LLM-Tor**) is a privacy-preserving proxy for public LLM APIs. It cryptographically separates payment identity from model usage using RSA blind signatures (RFC 9474) and onion-routed communication via Tor, so even the proxy operator cannot link a specific prompt to a specific paying customer.

The system provides **unlinkability** at the proxy layer — not absolute anonymity. Tor handles network-layer correlation (IP linkage, DNS leakage); blind signatures handle cryptographic unlinkability. These are independent and complementary protections.

## Repository Structure

- `src/` — Go backend server
- `desktop-client/` — Electron + React desktop app (the primary client)
- `Dockerfile` — Alpine-based Docker build for the backend

## Commands

### Backend (Go)

```bash
# Build
go build -o llmmask src/main.go

# Run tests
go test ./...

# Run a single package's tests
go test ./src/auth/...

# Docker
docker build -t llmmask .
```

### Desktop Client (from `desktop-client/`)

```bash
npm install

# Development
npm run dev

# Type-checking (run both)
npm run typecheck:node
npm run typecheck:web

# Lint
npm run lint

# Format
npm run format

# Build distributables
npm run build         # current platform
npm run build:mac
npm run build:win
npm run build:linux
npm run build:unpack  # build without packaging installer
```

## Architecture

### The Blind Token Protocol

The core privacy mechanism works in three phases. **Identity is present in phases 1 and 2; phase 3 is fully anonymous.**

1. **Credit Purchase** — identity linked: User pays via Paddle; server records credit balance linked to user identity.
2. **Blind Token Issuance** — identity present but token cryptographically unlinkable:
   - Client generates random 128-bit token `m`
   - Client blinds: `m' = m · r^e mod N` using the model-specific RSA public key
   - Server verifies credit balance, blind-signs: `s' = (m')^d mod N` (never sees `m`)
   - Client unblinds: `s = s' · r^{-1} mod N`, caches `(m, s)` pair
   - Security relies on RSA hardness and the one-more RSA assumption
3. **Anonymous Redemption** — no identity, routed via Tor:
   - Client establishes a Tor circuit
   - Client submits `(T, σ)` — the token and its unblinded signature
   - Server verifies RSA signature, checks `hash(T)` not previously spent
   - Server runs content moderation (cannot link content to user identity at this point)
   - Server forwards prompt to upstream LLM, marks token spent, returns response

**Token structure:** Random 128-bit value; model identifier is implicit (determined by which model-specific public key was used to blind); key identifier for rotation (planned, not yet implemented). Spent tokens are stored as `hash(token)` to prevent replay.

### Backend (`src/`)

| Package | Role |
|---|---|
| `svc/` | Chi HTTP router, middleware, all HTTP handlers |
| `auth/` | `AuthManager` (per-model) + `AbuseAuthManager` — RSA blind signing & verification |
| `llm-proxy/` | Validates tokens, prevents replay, routes to Gemini or OpenAI |
| `models/` | Azure Cosmos DB entities: `User`, `AuthToken`, `RSAKeys`, `AbuseTokenBlacklist`, `EncryptedTokenBackup` |
| `secrets/` | Azure Key Vault integration; generates & encrypts RSA key pairs (model + abuse keys) |
| `confs/` | Supported models, pricing, request size limits, abuse token constants |
| `log/` | Zap-based structured logging with redaction utilities |

**Key API endpoints:**
```
POST /api/v1/auth-token/{modelName}    # Issue blind-signed token (auth required)
POST /api/v1/llm-proxy                 # Proxy LLM request (token required, no auth)
GET  /api/v1/users/signin              # OAuth redirect
GET  /api/v1/users/grantGCP/callback   # OAuth callback
POST /api/v1/paddle/webhook            # Payment webhook
GET  /api/v1/model-pricing             # Pricing info
POST /api/v1/abuse-token/permanent     # Issue permanent abuse token (auth required)
POST /api/v1/abuse-token/transient     # Issue transient abuse token (auth required)
PUT  /api/v1/abuse-token/backup        # Store encrypted token backup (auth required)
GET  /api/v1/abuse-token/backup        # Fetch encrypted token backup (auth required)
```

**Supported models** (defined in `src/confs/models.go`): Google Gemini (`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-flash-preview`, `gemini-3-pro-preview`) and OpenAI (`gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `o1`).

**Infrastructure dependencies:** Azure Cosmos DB (data), Azure Key Vault (KMS), Paddle (payments), Google OAuth (identity).

### Desktop Client (`desktop-client/`)

**Electron main process** (`src/main/`):
- `index.ts` — App lifecycle, window management, IPC handlers, local OAuth capture server (port 5139)
- `torproxy.ts` — Spawns and monitors the bundled Tor binary
- `llmproxy.ts` — Sends LLM requests through Tor (SOCKS5 proxy); includes abuse tokens on every request
- `rsa.ts` — Blind RSA token generation using `@cloudflare/blindrsa-ts`
- `abuse-token.ts` — Abuse token generation, PBKDF2/AES-GCM backup encryption, electron-store persistence, server backup upload/download

**Renderer process** (`src/renderer/`):
- React 19 SPA with TailwindCSS
- Pages: `ChatInterface`, `ProfilePage`, `SettingsPage`, `PurchaseTokensPage`
- State via React contexts: `UserContext`, `ThemeContext`, `SettingsContext`, `ErrorContext`
- Chat history stored locally (not on server)
- `AbuseTokenSetupModal` — first-time setup (new / restore from file / restore from server)
- `TransientTokenExpiredModal` — monthly renewal prompt

**Startup sequence:** App starts → Tor initializes → tokens prefetched for all models → UI shown.

**IPC surface** (defined in `src/types/`): `generate-token`, `llm-proxy`, `start-auth`, `start-purchase`, `setup-abuse-tokens`, `refresh-transient-abuse-token`, `restore-abuse-token-backup`, `get-abuse-token-status`.

**RSA public keys** per model and for abuse tokens (`AbuseTokenPublicKeys`) are hardcoded in `src/types/config.ts` (fetched from server at build/deploy time).

### Abuse Prevention System

Every anonymous LLM request must include two long-lived blind-signed abuse tokens alongside the per-request token:

| Token | Structure | Validity |
|---|---|---|
| Permanent (`A_p`) | 48 random bytes | Lifetime of account |
| Transient (`A_t`) | 44 random bytes + 4-byte big-endian epoch | One calendar month |

**Epoch:** `year × 12 + month` (1-indexed). Both tokens use dedicated RSA key pairs (`abuse-permanent`, `abuse-transient` in Key Vault), independent of per-model keys.

**Issuance** (authenticated, Phase 2): client blinds and submits to `/api/v1/abuse-token/permanent` or `/transient`; server records issuance flag on `User` doc (`PermanentAbuseTokenIssuedAt`, `TransientAbuseTokenEpoch`) inside a per-user distributed semaphore to prevent double-issuance races.

**Verification** (anonymous, Phase 3): `llm_proxy.go` verifies both token signatures then checks both blacklists — **fail-closed** (DB error = reject, not pass).

**Blacklist:** `DocID = base64(SHA-256(token))` in `abuse_token_blacklist` Cosmos container, same pattern as spent auth tokens.

**Client backup:** PBKDF2(SHA-256, 600k iterations) → AES-256-GCM; format `base64(salt‖IV‖ciphertext)`. Always exported as a local `.llmtorbak` file; server sync is opt-in (server stores only ciphertext, cannot decrypt).

**Recovery:** Support clears `PermanentAbuseTokenIssuedAt` on the user doc — old token is *not* blacklisted (credits are per-request, no double-spend risk).

### Security Boundaries

- The server knows a user's identity (during sign-in and credit purchase) and that blind tokens were issued — but **cannot link which tokens to which user** (blind signature property).
- The server receives anonymous LLM requests over Tor — **cannot link the request IP to any identity**.
- Abuse tokens create a persistent **anonymous pseudonym** per user: requests are linkable to each other but not to any real identity.
- Single-use tokens (stored as `hash(token)` in Cosmos DB, marked spent atomically) prevent replay attacks.
- Content moderation runs server-side before forwarding to LLM, but at this point cannot be attributed to any user identity.
- Logs are redacted (`src/log/`) to avoid leaking sensitive data.

**Adversary model** (from whitepaper):
- *In scope*: honest-but-curious proxy operator, external network observer, malicious user attempting double-spend, upstream LLM provider
- *Out of scope*: global passive adversary controlling Tor, endpoint compromise, upstream LLM provider logging, stylometric fingerprinting

**Limitations:** LLM-Tor does not provide absolute anonymity. Tor is built into the official client but the inference endpoint currently allows clearnet access (future plan: exclusive Tor onion service hosting).

**Planned future work:** Key rotation, exclusive Tor onion hosting, ZK token systems, anonymous payment integration, post-quantum blind signatures, decentralized moderation.
