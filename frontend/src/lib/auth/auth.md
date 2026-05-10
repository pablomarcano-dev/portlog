# Auth Module

Frontend authentication plumbing for Portlog. Implemented in M1-S6 (POR-24).

## Architecture

### Token strategy

- **Access token**: in-memory only (`accessTokenStore`). Survives navigation; cleared on full page reload.
- **Refresh token**: httpOnly cookie set by the backend (`/auth/login`). Never visible to JS.

### Boot-time session restore

`main.tsx` calls `attemptSilentRefresh()` before the first React render. This hits `POST /auth/refresh` with the httpOnly cookie; if valid, the new access token is stored in-memory and the app renders authenticated. If no cookie or expired, the call fails silently and the app renders unauthenticated.

### 401 auto-refresh interceptor

`apiRequest` in `lib/api/client.ts` handles 401s from non-`/auth/` endpoints:

1. Acquires a single-flight `refreshInFlight` promise (prevents stampede when multiple concurrent requests all 401).
2. Calls `POST /auth/refresh` directly (bypasses `apiRequest` to avoid recursion).
3. Stores the new token in `accessTokenStore`.
4. Retries the original request once with the new token.
5. If refresh fails, clears the token and rethrows — the calling hook/mutation propagates the error.

### Files

| File                  | Purpose                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `accessTokenStore.ts` | Module-level token singleton with pub/sub for future React integration                       |
| `queries.ts`          | TanStack Query hooks: `useCurrentUser`, `useLogin`, `useLogout`; also `attemptSilentRefresh` |
| `../api/client.ts`    | Typed fetch wrapper with 401 interceptor                                                     |
| `../api/errors.ts`    | `ApiError` class                                                                             |

## Golden Rules observed

- **GR-1**: All files use TypeScript strict mode (inherited from `tsconfig.app.json`).
- **GR-2**: All auth types come from `@portlog/schemas` (`CurrentUserSchema`, `LoginResponseSchema`, `RefreshResponseSchema`, `LoginRequest`).
- **GR-3**: No `useEffect` for fetching — all server state via `useQuery`/`useMutation`.
- **GR-10**: Every API response is parsed through the corresponding Zod schema before use.

## What this module does NOT do

- Role enforcement / route gating (POR-25)
- Login / logout UI (POR-25)
- Token persistence across full page reloads (by design — refresh cookie handles that)
