# CLAUDE.md — src/ (Go backend)

Go backend for LLM-Tor. Chi HTTP router, Azure Cosmos DB for persistence, Azure Key Vault for RSA key management, Paddle for payments.

Module path: `llmmask` (see `go.mod`).

## Package overview

| Package | Role |
|---|---|
| `svc/` | Chi router setup, middleware, all HTTP handlers |
| `auth/` | `AuthManager` (per-model blind signing) + `AbuseAuthManager` |
| `llm-proxy/` | Token validation, replay prevention, upstream LLM routing |
| `models/` | Cosmos DB entities and `DBHandler` |
| `secrets/` | Azure Key Vault integration; RSA key generation and loading |
| `confs/` | Supported models, pricing, request size limits, abuse token constants |
| `log/` | Zap-based structured logging with redaction |
| `common/` | Shared utilities: credentials config, `Must()`, `Redactable` interface |

## API endpoints

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

## Common patterns

### Response helpers (`svc/`)

```go
render.Render(w, r, svc.Ok200(data))          // 200 with JSON data
render.Render(w, r, svc.ErrInternal(err))     // 500
render.Render(w, r, svc.ErrUnauthorized(err)) // 401
render.Render(w, r, svc.ErrInvalidRequest(err)) // 400
render.Render(w, r, svc.ErrNotFound())        // 404
```

`Ok200` automatically calls `.ToRedacted()` on any `common.Redactable` data.

### Auth middleware

- Session cookie → `models.DBHandler` lookup → `*models.User` stored in context.
- Retrieve with: `s.getUserFromContext(ctx)` → returns `*models.User`.
- `noValidationReq` (defined in `svc/signin.go`) is embedded in request structs that skip chi render validation.

### Cosmos DB (`models/`)

```go
models.DBHandler.Fetch(ctx, container, docID, partitionKey, &out)
models.DBHandler.Upsert(ctx, container, doc, partitionKey)
models.DBHandler.Delete(ctx, container, docID, partitionKey)
models.IsNotFoundErr(err) // true when Cosmos returns 404
models.DefaultPartitionKey  // = "primary" — used on all containers
```

Container names correspond to entity types (e.g. `rsa_keys`, `auth_tokens`, `abuse_token_blacklist`, `encrypted_token_backup`, `users`, `user_sessions`).

### RSA / auth (`auth/`, `secrets/`)

- `secrets.InitRSA()` loads all model RSA keys + abuse keys at startup.
- `auth.AuthManager` — per-model blind signing and verification.
- `auth.AbuseAuthManager` — signing/verification for permanent and transient abuse tokens.
- RSA key pairs stored in Cosmos `rsa_keys` container, encrypted at rest via Azure Key Vault.

### Models / confs

- `confs.ModelName` is a `string` type; constants defined in `src/confs/models.go`.
- `confs.CurrentEpoch()` — returns `year*12 + month` (1-indexed), used for transient abuse token validity.
- Supported models: Gemini (`gemini-2.5-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-flash-preview`, `gemini-3-pro-preview`) and OpenAI (`gpt-4.1`, `gpt-4.1-mini`, `gpt-4o`, `o1`).

### Abuse token blacklist

- `DocID = base64(SHA-256(token))` — same pattern for spent auth tokens.
- Blacklist check is **fail-closed**: any non-404 Cosmos error rejects the request.
- Semaphores prevent double-issuance races: `issue-permanent-abuse-token-{userDocID}` / `issue-transient-abuse-token-{userDocID}`.

### Logging (`log/`)

- Zap-based structured logging.
- Redaction utilities to avoid leaking tokens, keys, or user PII in logs.
- Use `log.Redact(value)` for sensitive fields.

## Infrastructure dependencies

- **Azure Cosmos DB** — all persistent state
- **Azure Key Vault** — RSA key encryption at rest
- **Paddle** — payment webhooks (credit balance updates)
- **Google OAuth** — user identity (sign-in only; anonymous redemption has no identity)
- **Gemini API / OpenAI API** — upstream LLM providers

## Entry point

`src/main.go` — initialises credentials, Cosmos, Key Vault, RSA keys, `Service`, and starts the HTTP server.
