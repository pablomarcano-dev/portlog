# Module: AIS Integration (Module 05)

**Story:** POR-57 — M3-S5
**Status:** Implemented
**Owner:** Backend

---

## Purpose

Exposes a single internal endpoint that resolves an IMO number to a normalized `AisVessel` record sourced from the VesselFinder API. Used by M3-S6 to auto-populate nomination ship particulars as advisory suggestions (never automatic overwrites).

---

## Endpoint

| Method | Path                    | Auth                  | Description                            |
| ------ | ----------------------- | --------------------- | -------------------------------------- |
| GET    | `/api/ais/vessels/:imo` | JWT + Roles(OPS, ADM) | Resolve IMO → AisVessel (cached 5 min) |

### Path params

| Param | Type   | Validation             |
| ----- | ------ | ---------------------- |
| `imo` | string | Exactly 7 digits (Zod) |

### Response codes

| Code | Condition                                                 |
| ---- | --------------------------------------------------------- |
| 200  | Success — returns `AisVessel` JSON                        |
| 400  | IMO format invalid                                        |
| 401  | Missing or invalid JWT                                    |
| 403  | Authenticated but role not OPS or ADM                     |
| 404  | VesselFinder has no record for this IMO                   |
| 429  | Provider rate limit exhausted after one Retry-After retry |
| 502  | Provider 5xx or returned an unexpected/malformed response |
| 503  | `VESSELFINDER_API_KEY` env var is not set                 |

---

## Environment Variables

| Variable                | Default                     | Notes                                                |
| ----------------------- | --------------------------- | ---------------------------------------------------- |
| `VESSELFINDER_API_KEY`  | _(required)_                | Obtain from vf-api.com. **Never log. Never commit.** |
| `VESSELFINDER_BASE_URL` | `https://api.vf-api.com/v2` | Override for testing/staging.                        |
| `AIS_CACHE_TTL_MS`      | `300000` (5 min)            | VesselFinder ToS allows up to 30 days.               |
| `AIS_RATE_LIMIT_RPS`    | `8`                         | Provider limit is 10 req/sec; we use 8 for headroom. |

---

## Architecture

```
AisController
  └── AisService
        ├── LRUCache<string, AisVessel>   (max 200, TTL from env)
        ├── Bottleneck                     (token bucket, 8 req/sec)
        └── VesselFinderClient
              ├── fetch() with X-API-Key header
              ├── One Retry-After-aware retry on 429 (cap 5 s)
              └── VesselFinderRawResponseSchema (Zod) → mapVesselFinderToAisVessel()
```

**No Prisma models in M3.** Persistent storage of AIS position history is deferred to M4 PEDR.

---

## Caching

- **Storage:** In-memory LRU (`lru-cache`), max 200 entries.
- **TTL:** 5 minutes (configurable via `AIS_CACHE_TTL_MS`).
- **Key:** IMO string.
- **Invalidation:** None in M3 — TTL-only expiry.
- **Log:** Both cache-hit and cache-miss paths log `{ event: 'ais.lookup', imo, cacheHit, durationMs }`.

---

## Rate Limiting

- **Library:** `bottleneck` token bucket.
- **Rate:** 8 req/sec (configurable via `AIS_RATE_LIMIT_RPS`).
- **Retry:** One retry on 429 from VesselFinder, honoring the `Retry-After` header (capped at 5 s). If still 429 after retry, a `TooManyRequestsException` (HTTP 429) is thrown.

---

## Integrity Callouts

- AIS data is **advisory only** — M3-S6 surfaces it as suggestions the user must explicitly accept before it writes to `ship_particulars`.
- The `VESSELFINDER_API_KEY` value must **never appear in pino logs**. The `X-API-Key` header is set directly on the fetch call and is not logged. The app-level pino redaction list in `app.module.ts` covers `req.headers.authorization` but the VesselFinder key travels in a custom header — confirm it never enters any logger argument (grep: `API_KEY`, `apiKey`, `api_key`).

---

## Files

| File                        | Role                                                                    |
| --------------------------- | ----------------------------------------------------------------------- |
| `ais.module.ts`             | NestJS module wiring                                                    |
| `ais.controller.ts`         | Route handler, Zod IMO validation                                       |
| `ais.service.ts`            | Cache + Bottleneck orchestration                                        |
| `ais.mapper.ts`             | Pure function: VesselFinderRaw → AisVessel                              |
| `vesselfinder.client.ts`    | HTTP client, retry logic, Zod schema validation                         |
| `ais.service.spec.ts`       | Unit tests (7 cases per AC)                                             |
| `packages/schemas/src/ais/` | `AisVesselSchema` (public) + `VesselFinderRawResponseSchema` (internal) |

---

## Repro Log

### 2026-05-12 — POR-57 Initial Implementation

- Created `backend/src/ais/` module with all files listed above.
- Installed `lru-cache@^11` and `bottleneck@^2` in `@portlog/backend`.
- Added `VESSELFINDER_API_KEY`, `VESSELFINDER_BASE_URL`, `AIS_CACHE_TTL_MS`, `AIS_RATE_LIMIT_RPS` to `backend/.env.example`.
- `AisModule` registered in `app.module.ts`.
- `AisVesselSchema` re-exported from `packages/schemas/src/index.ts`; `VesselFinderRawResponseSchema` kept internal.
- All 9 test cases pass (`npm test -w @portlog/backend`).
- `npm run typecheck` and `npm run lint` pass.
