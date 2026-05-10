# Auth Module

## Scope

Implements authentication and authorization for the Portlog backend.

- Passport-JWT access tokens (15-minute TTL by default)
- Opaque refresh tokens stored as SHA-256 hashes in the `refresh_tokens` table
- httpOnly, SameSite=Lax cookie for refresh token transport
- Global `JwtAuthGuard` (all routes protected by default; opt-out with `@Public()`)
- Global `RolesGuard` (enforced via `@Roles('ADM')` / `@Roles('OPS', 'ADM')`)
- Rate limiting on login: 5 attempts / 15 min / IP via `@nestjs/throttler`

## Endpoints

| Method | Path                | Auth   | Purpose                             |
| ------ | ------------------- | ------ | ----------------------------------- |
| POST   | `/api/auth/login`   | Public | Issue access token + refresh cookie |
| POST   | `/api/auth/refresh` | Public | Rotate refresh token pair           |
| POST   | `/api/auth/logout`  | JWT    | Revoke refresh token, clear cookie  |
| GET    | `/api/auth/me`      | JWT    | Return current user profile         |

## Security Design

- Passwords: bcrypt cost 12 minimum
- Refresh tokens: `crypto.randomBytes(32)` → raw sent to client only via cookie; `SHA-256(raw)` stored in DB
- Rotation: every `/refresh` call revokes the old token and issues a new one
- Reuse detection: if a revoked token is presented, the entire user's active refresh session is revoked
- Pino redaction: `password`, `passwordHash`, `tokenHash`, `token`, `refreshToken`, `Authorization` header

## Env Vars

| Var                    | Default                 | Description                    |
| ---------------------- | ----------------------- | ------------------------------ |
| `JWT_ACCESS_SECRET`    | —                       | Required. Min 32 bytes.        |
| `JWT_ACCESS_TTL`       | `15m`                   | Access token lifetime          |
| `JWT_REFRESH_TTL_DAYS` | `30`                    | Refresh token lifetime in days |
| `CORS_ORIGIN`          | `http://localhost:5173` | Allowed CORS origin            |
| `COOKIE_DOMAIN`        | `localhost`             | Cookie domain                  |
| `NODE_ENV`             | `development`           | Controls cookie Secure flag    |

## Module Log

### 2026-05-10 — Initial implementation (M1-S5 / POR-23)

- Implemented Passport-JWT strategy, guards, decorators, AuthService, AuthController
- Installed `@nestjs/throttler` and `@fastify/cookie`
- Wired global guards in AppModule; CORS + cookie plugin in main.ts
- Added pino redaction config
