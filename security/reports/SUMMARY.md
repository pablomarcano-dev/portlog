# Security audit — 2026-08-08

**Verdict:** 16 findings on the first run — **2 critical, 1 high**, 6 medium, 7 low. Secrets are clean across three engines. The critical items are both deployment-surface, not application logic: production is serving plain HTTP after an accidental config revert, and MinIO's admin console is published to the internet.
**Scope:** full local pass · commit `8ce0760` · 16 tools ran, 1 skipped (`--prod` not requested) · baseline: first run, so everything is New

---

## New this run

### PL-L4-7f6a5a4f — Critical — TLS was reverted out of the nginx config; production serves plain HTTP

**Where:** `nginx/conf.d/portlog.conf` (whole file)
**What:** `portlog.conf` is byte-identical to `portlog.conf.http-only`, the temporary bootstrap config used during certificate issuance. Commit `9561689` ("feat: add SSL via Let's Encrypt + sslip.io") added a working TLS server block; commit **`ca9fc05` (2026-06-23, "feat: add branch document hub and admin user management")** replaced the file with the HTTP-only version again. The revert looks accidental — it is unrelated to that commit's subject.

Lost in the revert:

- the `listen 443 ssl http2` server block and both certificate paths
- `ssl_protocols TLSv1.2 TLSv1.3` / `ssl_ciphers HIGH:!aNULL:!MD5`
- the `return 301 https://$host$request_uri` redirect
- `client_max_body_size 50M`

**Failure scenario:** Every login POST and every subsequent request carrying the `refresh_token` cookie crosses the public internet in cleartext. Anyone on a path between an agency user and `167.233.48.84` — coffee-shop Wi-Fi, a compromised router, the hosting network — reads the password on the login request and the refresh token on every request after it. The refresh token has a 30-day TTL and `path: '/'`, so a single captured request is a month of full account access. `docker-compose.yml` still publishes 443 and still runs the certbot renewal loop, so from the outside the deployment looks TLS-enabled while nothing is listening on it.

**Also non-security:** the lost `client_max_body_size 50M` drops nginx to its 1M default, so **email attachments over 1 MB now fail with 413** at the proxy — a live regression in the attachments feature.

**Undetermined:** whether `COOKIE_SECURE` is `true` or `false` in the production `.env` (that file lives on the box, not in the repo). If `true`, the refresh cookie is never transmitted over HTTP and sessions silently fail to refresh; if `false`, the token crosses in cleartext. Both are bad, in different ways — worth checking which one is happening.

**Detected by:** manual review (L7). No scanner flagged this; they check the config that exists, not the one that used to.
**Fix:** restore the 443 server block from `git show 9561689:nginx/conf.d/portlog.conf`, confirm the certs are still on the box under `/etc/letsencrypt/live/167.233.48.84.sslip.io/`, redeploy. Consider deleting `portlog.conf.http-only` afterwards so the two files cannot be confused again.

---

### PL-L4-f3363709 — Critical — MinIO S3 API and admin console published to the internet

**Where:** `docker-compose.yml:80-82`
**What:** MinIO is the only service in the stack using `ports:` for its data and console ports (`9000:9000`, `9001:9001`), which binds them on all host interfaces. Postgres correctly uses `expose:`, keeping it on the compose network. Nothing proxies MinIO through nginx, so both ports face the internet directly, protected only by `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD` from `.env`.

**Failure scenario:** The admin console at `:9001` is a public login page for the object store holding the `sgc-documents` bucket — every issued PEDR, SOF, NOR and SH-xx PDF plus all email attachments. Credential stuffing, a weak root password, or any future MinIO auth CVE yields not just read access to legally binding documents but **write** access: an attacker can replace an issued document with an altered one, and the application would serve the substitute without any signal that it changed. There is no object-lock or versioning configured to detect it.

**Severity note:** exposure of an authenticated admin surface is High by the rubric. Bumped to Critical under the domain-integrity rule — the bucket holds issued documents, and silent substitution after issue is precisely the failure Portlog's Golden Rules exist to prevent.

**Detected by:** compose port probe (L7), corroborated by manual review
**Fix:** switch both ports to `expose:`, or bind to loopback (`127.0.0.1:9000:9000`) if you need host access for debugging. The backend reaches MinIO over the compose network at `minio:9000` and does not need either published. If the console is genuinely needed remotely, put it behind nginx with auth rather than on a raw port.

---

### PL-L7-fa42f616 — High — The refresh token is written to the application logs on every request

**Where:** `backend/src/app.module.ts:58-69`
**What:** The pino `redact` list covers `req.body.password`, `req.headers.authorization`, `*.passwordHash`, `*.tokenHash`, `*.token` and `*.refreshToken` — but not `req.headers.cookie` or `res.headers["set-cookie"]`. No custom serializers are configured, so pino-http's defaults apply, and those serialise the **full** `req.headers` and `res.headers` objects.

**Failure scenario:** The refresh token is delivered as a cookie with `path: '/'`, so the browser attaches it to every API request. Each of those requests logs `req.headers.cookie` containing the raw token; each login and refresh logs `res.headers["set-cookie"]` containing the newly issued one. Anyone who can read the logs — a container shell, a mounted log volume, a backup, a future log shipper — holds a live 30-day credential for whichever user made the request. Redaction is doing exactly what it was configured to do; the configuration is simply one level too shallow, and the comment above it ("passwords, tokens, and hashes never appear in logs") reads as though the case is already covered.

**Detected by:** manual review (L7 check 6)
**Fix:** add `'req.headers.cookie'` and `'res.headers["set-cookie"]'` to the `redact` array. Consider `'req.headers'` wholesale with an allowlist if the header set grows.

---

### PL-L1-30873292 — Medium — 12 unpatched advisories in the production dependency tree

**Where:** `package-lock.json` (backend runtime deps)
**What:** Four engines agree on the same set — npm audit, OSV-Scanner, Trivy and Grype. All have fixes available. **None is currently exploitable in this configuration**, which is why this is one Medium rather than a critical and nine highs; the reachability analysis is below so the ratings stay reviewable.

| Package                                                                        | Scanner rating | Verdict here | Why                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | -------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tar@6.2.1` (12 advisories, one CVSS-critical)                                 | Critical       | **Medium**   | Reached only via `bcrypt → @mapbox/node-pre-gyp`, which runs at install time to fetch prebuilt binaries. Not on any runtime path. Exploiting it needs a hostile binary host or a MITM during `docker compose build`, and the blast radius is the build container.      |
| `fastify@5.8.4` — body schema validation bypass via leading-space Content-Type | High           | **Low**      | Portlog validates with `ZodValidationPipe` (`APP_PIPE`), which runs after parsing and is independent of fastify's JSON-schema layer. No route schemas are declared. A request that dodges fastify's validation still meets Zod, and an unparsed body fails Zod closed. |
| `@nestjs/platform-fastify@11.1.19` — middleware bypass via trailing slash      | High           | **Low**      | The codebase registers no Nest middleware at all (no `configure(consumer)`, no `NestMiddleware`). Guards are `APP_GUARD` and are unaffected by this bug. Nothing to bypass.                                                                                            |
| `nodemailer@8.0.7` — CRLF injection in `List-*` header comments                | High           | **Low**      | `EmailService.send()` sets only `to`/`cc`/`bcc`/`subject`/`html`/`attachments`. No `List-*` headers and no custom header object anywhere in the email module.                                                                                                          |
| `find-my-way@9.5.0` — HTTP/2 DoS                                               | High           | **Low**      | HTTP/2 is not enabled: `main.ts` creates a plain Fastify adapter, and nginx proxies HTTP/1.1 upstream.                                                                                                                                                                 |
| `ws@8.20.1` — memory-exhaustion DoS                                            | High           | **Low**      | Present only via `puppeteer-core`'s CDP channel to the Chrome instance we launch ourselves. Not attacker-reachable.                                                                                                                                                    |
| `fast-uri@3.1.2` (3 advisories)                                                | High           | **Low**      | Via `fastify → @fastify/ajv-compiler → ajv-formats`, used for `format: uri` schema validation we do not rely on.                                                                                                                                                       |
| `brace-expansion` (3 advisories)                                               | High           | **Low**      | Transitive build tooling; DoS via pathological glob patterns we control.                                                                                                                                                                                               |
| `tmp@0.2.5`                                                                    | High           | **Low**      | Via frontend `exceljs`; the `tmp` path is Node-only and not in the browser bundle.                                                                                                                                                                                     |
| `uuid@8.3.2`, `exceljs`                                                        | Moderate       | **Low**      | Bounds check only triggers when a `buf` argument is passed, which the frontend does not do.                                                                                                                                                                            |

**Failure scenario:** No single one lands today. The aggregate risk is drift: the tree is far enough behind that the next advisory in `fastify` or `nodemailer` is likely to be reachable, and by then the upgrade is a bigger jump. `npm audit fix` closes most of these without a breaking change.

**Detected by:** npm audit, osv-scanner, trivy, grype (four-way agreement)
**Fix:** `npm audit fix`, then re-run the audit to confirm the set shrinks. `exceljs@3.4.0` is a major downgrade — leave that one and accept it in the baseline.

---

### PL-L4-80f7be5b — Medium — Backend and frontend containers run as root

**Where:** `backend/Dockerfile:71`, `frontend/Dockerfile:26`
**What:** Neither Dockerfile has a `USER` directive, so the runtime stage runs as root. The backend also runs `npx prisma migrate deploy` as root on every container start.
**Failure scenario:** Any RCE in the Node process — a deserialization bug, a compromised dependency, a Puppeteer sandbox escape while rendering a PDF — starts as root inside the container rather than as an unprivileged user, removing the last cheap barrier before a container-escape attempt. No Docker socket is mounted, which keeps this from being High.
**Detected by:** semgrep (`dockerfile.security.missing-user`) and trivy (`DS-0002`), agreeing
**Fix:** add a non-root `USER` to both runtime stages. The backend needs write access only to its temp/PDF scratch paths.

### PL-L7-f6104bb9 — Medium — No security headers anywhere

**Where:** `backend/src/main.ts`, `nginx/conf.d/portlog.conf`
**What:** `helmet` is not a dependency and is not registered on the Fastify app; the nginx config contains no `add_header` directives. So no HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options` or `Referrer-Policy` on any response.
**Failure scenario:** Missing `X-Content-Type-Options: nosniff` lets a browser MIME-sniff an uploaded attachment served from the API into executable HTML; missing frame protection allows clickjacking of the document-approval screens. HSTS is the one that compounds PL-L4-7f6a5a4f — with TLS restored but no HSTS, a downgrade attack puts users back on the cleartext path.
**Detected by:** hygiene probe (L7)
**Fix:** `@fastify/helmet` on the app, plus `add_header` directives in nginx for the static frontend. Add HSTS only after TLS is working again.

### PL-L5-71cbf35b — Medium — No `permissions:` block in any workflow

**Where:** `.github/workflows/ci.yml`, `deploy.yml`, `e2e.yml`
**What:** All three workflows inherit the repository-default `GITHUB_TOKEN` scope instead of declaring least privilege.
**Failure scenario:** Any compromised action or injected step in these workflows gets whatever the repo default grants — on older repo settings that is write access to contents. `deploy.yml` matters most because it also holds `DEPLOY_SSH_KEY`. That key is partly defanged: it is pinned in `authorized_keys` to a forced command, so leaking it buys a redeploy of `main` rather than a shell, and that reasoning is already documented in the workflow. The token scope is the part still open.
**Detected by:** workflow probe (L5)
**Fix:** `permissions: {}` at workflow level, granting per job only what it needs.

### PL-L5-7010b8bf — Medium — Actions pinned to mutable tags

**Where:** `ci.yml:17,19`; `e2e.yml:37,40,85`
**What:** `actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-artifact@v4`. A tag can be repointed by whoever controls the action repo; a SHA cannot.
**Failure scenario:** A compromise of any of these upstream repos, or of a maintainer account, silently changes what runs in a pipeline that has access to `DEPLOY_SSH_KEY`. This is the exact shape of the 2026 npm and Actions supply-chain incidents. `deploy.yml` is unaffected — it uses no actions at all.
**Detected by:** semgrep (`github-actions-mutable-action-tag`) and the workflow probe, agreeing
**Fix:** pin to full commit SHAs with the version in a trailing comment; Dependabot updates SHA pins fine.

### PL-L7-c4a77f3e — Medium — Environment is not validated at startup

**Where:** `backend/src/app.module.ts:50-53`
**What:** `ConfigModule.forRoot({ isGlobal, envFilePath })` with no `validate` or `validationSchema`. `JWT_ACCESS_SECRET` is checked by hand in `auth.module.ts` and `jwt.strategy.ts`, but nothing else is.
**Failure scenario:** A missing or misspelled variable produces a running app with a silently wrong security control rather than a boot failure. `COOKIE_SECURE`, `CORS_ORIGIN` and `SMTP_*` all fall back to defaults. Given the `TZ` variable is documented as load-bearing for document correctness, an unvalidated environment is also a document-integrity risk, not only a security one.
**Detected by:** manual review (L7 check 1)
**Fix:** a Zod schema passed to `ConfigModule.forRoot({ validate })`, covering every key in `.env.example`.

### PL-L7-0186276f — Medium — CORS falls back to a permissive dev default

**Where:** `backend/src/main.ts:44`
**What:** `const corsOrigin = process.env['CORS_ORIGIN'] ?? /^http:\/\/localhost(:\d+)?$/`, used with `credentials: true`.
**Failure scenario:** A production deploy that forgets `CORS_ORIGIN` gets the localhost regex instead of a hard failure. That specific fallback is not remotely exploitable on its own, but it fails open and silently: the app keeps serving while its origin allowlist no longer matches reality. `CORS_ORIGIN` is also absent from `.env.example`, so nothing prompts anyone to set it.
**Detected by:** manual review (L7 check 11)
**Fix:** require `CORS_ORIGIN` in production via the startup validation from PL-L7-c4a77f3e; keep the regex only when `NODE_ENV !== 'production'`.

### PL-L4-98cc327d — Medium — `minio/minio:latest` is unpinned

**Where:** `docker-compose.yml:78`
**What:** The only unpinned image in the stack; postgres and nginx are pinned to `16-alpine` and `alpine`.
**Failure scenario:** `docker compose build && up -d` on the box can silently change the MinIO version — pulling in a regression, a breaking change, or a compromised image — with no corresponding commit. Combined with PL-L4-f3363709 this is the internet-facing service that changes without review.
**Detected by:** hygiene probe (L7)
**Fix:** pin to a specific release tag, ideally a digest.

---

### PL-L7-f769e221 — Low — `.env` files are group-readable

`.env` (0664), `backend/.env` (0664), `frontend/.env` (0664) on the dev machine. `0600` is the norm for files holding live credentials. Dev-machine only; the production `.env` was not inspected.
**Fix:** `chmod 600 .env backend/.env frontend/.env`.

### PL-L1-5a723d5a — Low — No dependency cooldown configured

No `.npmrc`, so `min-release-age` is unset. npm 11.13.0 is installed and supports it (added in 11.10.0). A 7-day cooldown filters most compromised releases at the install layer, since malicious versions are typically yanked within hours.
**Fix:** create `.npmrc` with `min-release-age=7`.

### PL-L7-609a1c76 — Low — JWT algorithms not pinned on verification

`jwt.strategy.ts` passes `secretOrKey` with no `algorithms` option, so passport-jwt accepts jsonwebtoken's defaults. **Not currently exploitable:** the secret is a symmetric string, so jsonwebtoken restricts verification to the HS family and rejects `alg: none` — there is no asymmetric key to confuse it with. Worth pinning anyway, because the day someone switches to RS256 the protection disappears silently.
**Fix:** `algorithms: ['HS256']` in the strategy options.

### PL-L7-f4a59467 — Low — `.env` / `.env.example` drift

Documented but absent from the local `.env`: `AIS_API_KEY`, `AIS_PROVIDER`, `COMPOSE_PROJECT_NAME`, `DATABASE_URL`, `PORT`, `SMTP_SECURE`, `TZ`, `WHATSAPP_MODE`, `TWILIO_*`. Present but undocumented: `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`. `CORS_ORIGIN` appears in neither, despite being read at startup. `TZ` missing locally is the notable one — it is documented as load-bearing for document timestamps.
**Fix:** reconcile both files; add `CORS_ORIGIN` to `.env.example`.

### PL-L7-3c72e850 — Low — Refresh route inherits the global rate limit

`POST /api/auth/login` correctly carries `@Throttle({ default: { limit: 5, ttl: 15min } })`. `POST /api/auth/refresh` is `@Public()` with no override, so it inherits the global 60/min. It is a token-guessing surface, and 60/min is generous for it.
**Fix:** add a matching `@Throttle()` to `refresh`.

### PL-L4-e-nginx-host — Low — `$host` forwarded to upstream

`proxy_set_header Host $host` passes the client-supplied Host header through (4 occurrences across both nginx configs; semgrep `generic.nginx.security.request-host-used`). **Verified not currently exploitable:** nothing in `backend/src` reads `req.headers.host` or builds absolute URLs from the request — no password-reset links, no host-derived redirects. Recorded so that the day someone adds one, this is already on the list.

---

## Still open

Nothing — first run.

## Closed since previous report

Nothing — first run.

## Accepted (baseline)

None. `security/baselines/accepted.json` is empty.

---

## Passed checks worth stating

A clean result is only meaningful if you know it was actually tested:

- **Secrets: clean across three independent engines.** Gitleaks scanned all 168 commits (6.73 MB) with no leaks; TruffleHog scanned 3,618 chunks and found 0 verified _and_ 0 unverified secrets; Trivy's secret scanner found none. Nothing sensitive has ever been committed to this repo.
- **Authorization: all 32 controllers** carry `@Roles()` or `@Public()`. Nothing relies on the global guard's default.
- **`@Public()` inventory is minimal and justified:** health, login, refresh. The test-only email controller (`test-email.controller.ts`) is `@Public()` but is registered conditionally on `NODE_ENV === 'test'` in `email.module.ts`, evaluated at module definition — it does not exist in a production build.
- **Cookie flags:** `httpOnly: true`, `secure` from config, `sameSite: 'lax'`, bounded 30-day `maxAge`. Only `path: '/'` could be tightened to the refresh endpoint.
- **No `console.log` in `backend/src`**, so nothing bypasses pino.
- **No raw SQL** — no `$queryRawUnsafe` or `$executeRawUnsafe` anywhere.
- **Login rate limiting** is correctly tightened to 5 per 15 minutes.
- **Placeholder secrets** (`change_me_in_production`) appear only in `.env.example`, never in a real `.env`.

## Coverage

| Layer               | Tools                                                                | Status                               |
| ------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| L1 dependencies     | npm audit (prod + all), npm audit signatures, osv-scanner            | ok                                   |
| L2 secrets          | gitleaks, trufflehog (verified), trivy secret scanner                | ok                                   |
| L3 code             | semgrep (`p/typescript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets`) | ok — 11 findings                     |
| L4 containers       | trivy fs, syft (SBOM), grype, hadolint ×2                            | ok                                   |
| L5 pipeline         | workflow probe                                                       | ok                                   |
| L6 runtime exposure | —                                                                    | **not run** (`--prod` not requested) |
| L7 manual           | 14 checks                                                            | 14 completed, 0 undetermined         |

**What is therefore unknown:** L6 was not run, so nothing here reflects what the box actually exposes. That gap matters more than usual this week — PL-L4-f3363709 (MinIO on 9000/9001) and PL-L4-7f6a5a4f (no TLS) are both claims about the _intended_ configuration read from the repo. An `nmap` against `167.233.48.84` would confirm whether those ports are genuinely reachable and whether 443 answers at all. Recommend running `./security/run-scanners.sh --prod` next.

Also unknown: the production `.env` (it lives on the box), so `COOKIE_SECURE`, `CORS_ORIGIN` and the real MinIO root password were not inspected.

### Scanner caveats

- Trivy's filesystem scan included `node_modules`, so its misconfiguration list contains ~20 findings from vendored Dockerfiles inside `getos` that are not ours. Only `backend/Dockerfile` and `frontend/Dockerfile` were counted. The runner should pass `--skip-dirs node_modules`.
- `coverage.json` notes contain a stray `pulling <image>` prefix on first-pull entries — a cosmetic bug in the runner's `pull()` helper, which logs to stdout inside a command substitution. Digests are still recorded correctly.
- Semgrep reported parse errors on two `deploy.yml` steps and one `.tsx` file. These are rule-engine limitations, not scan failures; the files were still scanned by other rules.
- Images were pulled from floating `:latest` tags. Digests are recorded in `coverage.json` — pin `security/tools.env` to those digests so next week's diff reflects code changes rather than scanner upgrades.
