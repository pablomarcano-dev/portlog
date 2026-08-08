# Security audit — 2026-08-08

**Verdict:** Remediation pass complete. **Both criticals and the high are fixed**; 10 of 17 findings closed, 1 accepted, 6 still open (4 of them blocked on upstream releases). One new finding raised during the fix. Nothing is deployed — all work is on `security/audit-fix-2026-08-08`, and the TLS commit must not ship until certificates are confirmed on the box.
**Scope:** full local pass · audited at `8ce0760` · fixed across 13 commits · 16 tools ran, 1 skipped (`--prod` not requested)

---

## Closed this pass

| ID             | Sev      | Title                                            | Commit    | Verified by                                                                                                |
| -------------- | -------- | ------------------------------------------------ | --------- | ---------------------------------------------------------------------------------------------------------- |
| PL-L4-7f6a5a4f | Critical | TLS reverted out of the nginx config             | `1c7d330` | `nginx -t` passes with certs stubbed; 443 block, HTTPS redirect and `client_max_body_size 50M` restored    |
| PL-L4-f3363709 | Critical | MinIO S3 API + console published to the internet | `011eb26` | `docker compose config` now shows only nginx publishing 80/443                                             |
| PL-L7-fa42f616 | High     | Refresh token written to logs on every request   | `a415b84` | Runtime: canary cookie sent to a live backend, log reads `"cookie": "[Redacted]"`, zero canary occurrences |
| PL-L7-c4a77f3e | Medium   | No environment validation at startup             | `82c6bb7` | Runtime: missing `MINIO_SECRET_KEY` now fails at boot; dev still boots                                     |
| PL-L7-f6104bb9 | Medium   | No security headers                              | `aa3ae64` | `curl -I` returns nosniff / DENY / Referrer-Policy; nginx adds HSTS on the TLS vhost                       |
| PL-L5-71cbf35b | Medium   | No `permissions:` block in any workflow          | `1670cc5` | Workflow probe: `permissions_block: present` ×3                                                            |
| PL-L5-7010b8bf | Medium   | Actions pinned to mutable tags                   | `1670cc5` | Workflow probe: `unpinned_actions: none` ×3                                                                |
| PL-L4-98cc327d | Medium   | `minio/minio:latest` unpinned                    | `657ce3c` | Hygiene probe: `unpinned image tags: none`                                                                 |
| PL-L7-609a1c76 | Low      | JWT algorithms not pinned                        | `2b4b1ea` | `algorithms: ['HS256']` on the verifier; 318 backend tests pass                                            |
| PL-L7-3c72e850 | Low      | Refresh route inherited the global rate limit    | `e870f37` | `@Throttle` 20/15min on `POST /auth/refresh`                                                               |
| PL-L1-5a723d5a | Low      | No dependency cooldown                           | `6532ec4` | Coverage probe: `min-release-age configured`                                                               |
| PL-L7-f769e221 | Low      | `.env` files group-readable                      | —         | `chmod 600` applied to all three local files; production is a handover item                                |

Also fixed, discovered during remediation rather than in the audit:

- **`StorageService` fell back to `minioadmin`/`minioadmin`** when `MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY` were unset — MinIO's documented default credentials, guarding every issued document. Removed in `82c6bb7`; presence is now required at boot.
- **The `/storage/` nginx proxy to `minio:9000`** was also lost in the `ca9fc05` revert. Deliberately **not** restored (`1c7d330`): nothing references that path, it has been absent seven weeks with no breakage, and re-adding a public route to the object store would undo PL-L4-f3363709.

## Still open

| ID             | Sev    | Title                                                     | Why it is still open                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------- | ------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PL-L1-30873292 | Medium | 7 of 12 production advisories remain                      | **4 have no patched release at all.** `find-my-way` is vulnerable at `<=9.6.0` and 9.6.0 is the latest; `tar` at `<=7.5.20` likewise; `@nestjs/platform-fastify` and `@mapbox/node-pre-gyp` only inherit those. npm's `fixAvailable: true` overstated this — the original report repeated it uncritically. Blocked upstream; recheck weekly.                                                                                                                                                                                                                             |
| —              | Medium | `nodemailer` 8.0.11 → 9.0.5                               | A real fix exists but it is a major bump. The advisory concerns the message-level `raw` option bypassing `disableFileAccess`; `EmailService` never uses `raw`, so it is not reachable. Deferred pending a decision on the major.                                                                                                                                                                                                                                                                                                                                         |
| PL-L7-0186276f | Medium | CORS falls back to a dev default in production            | Downgraded to a startup warning rather than a hard failure, because of the new finding below. Reinstate as a throw once `NODE_ENV` resolves correctly.                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **NEW**        | Medium | `NODE_ENV` resolves to `production` on developer machines | The monorepo-root `.env` (which carries the docker-compose values, including `NODE_ENV=production`) wins over `backend/.env` regardless of the `envFilePath` pin on `ConfigModule.forRoot` — the working-directory ambiguity that comment already warns about. Consequences today: pino-pretty is disabled locally, the test-email controller is excluded, and any production-gated check misfires in dev. This is what forced PL-L7-0186276f to warn instead of throw. Needs its own session — the fix touches which `DATABASE_URL` wins, so it is not a safe drive-by. |
| PL-L4-80f7be5b | Medium | `frontend/Dockerfile` still runs as root                  | Backend fixed. The frontend is `nginx:alpine`, whose workers already drop to the `nginx` user while the master needs root to bind 80. Running it unprivileged means changing the listen port, pid and temp paths, and the `frontend:80` upstream — more change than the finding warrants for a static-file container.                                                                                                                                                                                                                                                    |
| PL-L7-f4a59467 | Low    | `.env` / `.env.example` drift                             | `CORS_ORIGIN` documented (`964e84b`). The rest of the drift is in gitignored machine-local files — a handover item.                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Accepted (baseline)

| ID                 | Title                                            | Reason                                                                                                                                                                                                        | Expires    |
| ------------------ | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| PL-L4-e-nginx-host | nginx forwards the client `Host` header upstream | Only exploitable if the app derives absolute URLs from the request Host. Verified none do — nothing reads `req.headers.host`, and `APP_URL` comes from config. Re-check the moment any feature emails a link. | 2027-02-08 |

`exceljs`/`uuid` was offered for acceptance and declined, so it stays under Still open as part of PL-L1-30873292.

## Do these on the box

1. **Before merging the TLS commit** (`1c7d330`) — nginx exits rather than degrading if a certificate file is missing, so a lapsed cert turns this into a full outage:

   ```
   ssh portlog-prod 'cd /opt/portlog && docker compose run --rm certbot certificates'
   ```

   → expect a valid entry for `167.233.48.84.sslip.io`. If it is missing or expired, reissue **before** merging, then `docker compose exec nginx nginx -t` before reloading.

2. **Check which way `COOKIE_SECURE` is set in production** — the audit could not determine it:

   ```
   ssh portlog-prod 'grep COOKIE_SECURE /opt/portlog/.env'
   ```

   → with TLS restored it should be `true`. If it currently reads `false`, refresh tokens have been crossing in cleartext; if `true`, sessions have been silently failing to refresh.

3. **Set `CORS_ORIGIN` in the production `.env`** — it is read at startup, was documented nowhere, and startup now warns when it is missing:

   ```
   ssh portlog-prod 'grep -E "CORS_ORIGIN|^TZ=" /opt/portlog/.env'
   ```

   → both should be present; `TZ=America/Caracas`.

4. **Tighten production `.env` permissions** (fixes PL-L7-f769e221 there; local copies are already `0600`):

   ```
   ssh portlog-prod 'chmod 600 /opt/portlog/.env'
   ```

   → no output means success.

5. **Review the MinIO root password strength** — it was internet-reachable until commit `011eb26` deploys. Rotate if it is weak or reused; generate with `openssl rand -base64 32`. The value was never inspected and must not be pasted anywhere.

## Coverage

| Layer               | Tools                                                                | Status                               |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| L1 dependencies     | npm audit (prod + all), npm audit signatures, osv-scanner            | ok                                   |
| L2 secrets          | gitleaks, trufflehog (verified), trivy secret scanner                | ok — clean                           |
| L3 code             | semgrep (`p/typescript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets`) | ok                                   |
| L4 containers       | trivy fs, syft (SBOM), grype, hadolint ×2                            | ok                                   |
| L5 pipeline         | workflow probe                                                       | ok                                   |
| L6 runtime exposure | —                                                                    | **not run** (`--prod` not requested) |
| L7 manual           | 14 checks                                                            | 14 completed                         |

**What is therefore unknown:** L6 never ran, so nothing here reflects what the box actually exposes. Both criticals were claims about the _intended_ configuration read from the repo. Now that the fixes exist, `./security/run-scanners.sh --prod` after deploying would confirm 9000/9001 are closed and 443 answers — that is the natural next step.

Also unknown: the production `.env`, so `COOKIE_SECURE`, `CORS_ORIGIN` and the MinIO root password were never inspected. Hence items 2–5 above.

### Verification gate

`npm run typecheck` clean across all workspaces, `npm run lint` clean, **541 tests pass** (backend 318, frontend 151, schemas 72). The backend image was built and run: it starts as `uid=1000(node)` and reaches `P1001 Can't reach database server` against a bogus DSN, proving `npx` and the Prisma engine work unprivileged.

### Notes for next week

- Runner bugs fixed in `7a95af0`: trivy now skips `node_modules` (it was reporting ~20 vendored Dockerfiles from `getos`), and `coverage.json` notes no longer carry a stray `pulling …` prefix.
- `security/tools.env` still uses floating `:latest` tags. Digests from this run are in `coverage.json` — pin them so next week's diff reflects code changes rather than scanner upgrades.
- Re-run `npm audit --omit=dev` weekly against the four upstream-blocked advisories; they close as soon as `find-my-way` and `tar` publish patched releases.
