# Security Audit — tooling, patterns, and the weekly autonomous run

Research-backed plan for a recurring, mostly-autonomous security audit of Portlog.
Companion to [STACK.md](STACK.md) (Golden Rules) and [DEPLOYMENT.md](DEPLOYMENT.md) (the box).

> Status: the audit runner and the `/security-audit` skill are **built and working** (section 6).
> The per-PR CI subset and custom Semgrep rules are **not yet built**. Section 8 lists what a
> first pass found by hand on 2026-08-08.

---

## 1. Threat model (what we are actually defending)

Sizing the audit to the real system keeps it from becoming noise:

| Fact                                                               | Consequence for the audit                                                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| ~10 users, 2 roles (`OPS`, `ADM`), no public signup                | Authz bugs matter more than volumetric abuse.                                                                          |
| Single Hetzner box, `docker compose`, self-hosted Postgres + MinIO | Host exposure and container CVEs are _our_ problem — no cloud provider absorbs them.                                   |
| Public GitHub repo, deploy key held as an Actions secret           | Secret leakage and CI/CD supply chain are first-class risks, not theoretical.                                          |
| Documents are legally binding (PEDR, SOF, NOR, SH-xx)              | **Integrity > confidentiality.** Silent data tampering or a wrong timestamp is the worst outcome, ahead of disclosure. |
| Solo maintainer                                                    | The audit must be low-noise and self-triaging, or it will be ignored after week three.                                 |

Corollary: the weekly run's job is **not** to produce a 400-line scanner dump. It is to produce a
short, deduplicated, severity-ranked report where every line is worth reading.

---

## 2. The seven layers

Industry practice converges on five scanner categories — SCA, secrets, SAST, IaC/container, DAST
([Orca Security's 2026 AppSec roundup](https://orca.security/resources/blog/open-source-application-security-tools/)).
Two more matter for a self-hosted, single-box deployment:

| #   | Layer                       | Question it answers                                                       |
| --- | --------------------------- | ------------------------------------------------------------------------- |
| L1  | Dependencies / supply chain | Do we ship a known-vulnerable or malicious package?                       |
| L2  | Secrets                     | Is a credential in git history, in a build arg, or in a log line?         |
| L3  | Code (SAST)                 | Do we have injection, weak crypto, missing authz, unsafe deserialization? |
| L4  | Config / containers / IaC   | Is a port published, an image unpinned, a container running as root?      |
| L5  | CI/CD pipeline              | Can a PR from a fork steal `GITHUB_TOKEN` or the deploy key?              |
| L6  | Runtime / server exposure   | What does the internet actually see on `167.233.48.84`?                   |
| L7  | App semantics               | Env-var handling, log redaction, role guards, cookie flags, rate limits.  |

L1–L6 are tool-driven and cheap. **L7 is the layer no scanner covers** — it is the one an agent
run is genuinely good at, because it requires reading our code against our own rules.

---

## 3. Recommended toolchain (all free, all self-hosted)

Chosen for: runs offline in a container or CI runner, no account required, SARIF or JSON output,
and no source code leaving the box.

### L1 — Dependencies & supply chain

| Tool                                                     | Role                                                                                                                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm audit --omit=dev`                                   | Baseline gate, already installed, zero cost. Run per-PR.                                                                                                                                                                  |
| [**OSV-Scanner**](https://github.com/google/osv-scanner) | Broader advisory coverage than the npm registry alone; reads `package-lock.json` directly. Google-maintained, the same OSV database [OpenSSF Scorecard uses](https://github.com/ossf/scorecard/blob/main/docs/checks.md). |
| `npm audit signatures`                                   | Registry provenance/signature verification. Manual today — npm does not enforce it at install time.                                                                                                                       |
| **`min-release-age`** in `.npmrc`                        | Dependency cooldown. Added in **npm CLI 11.10.0** (Feb 2026); we run npm 11.13.0, so it is available now. `min-release-age-exclude` needs 11.19.0+.                                                                       |

The cooldown is the single highest-leverage line of config here. Compromised releases are usually
yanked within hours of publication, so even a 24-hour delay filters most incidents at the install
layer; 7 days is the common setting
([Socket](https://socket.dev/blog/npm-introduces-minimumreleaseage-and-bulk-oidc-configuration),
[cooldowns.dev](https://cooldowns.dev/)). Both 2026 Shai-Hulud variants executed via `preinstall`
scripts, which is also why `ignore-scripts` is worth considering for CI installs
([Mondoo](https://mondoo.com/blog/npm-supply-chain-security-package-manager-defenses-2026)).

```ini
# .npmrc
min-release-age=7
```

### L2 — Secrets

| Tool                                                                                 | Role                                                                                                          |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| [**Gitleaks**](https://github.com/gitleaks/gitleaks)                                 | Pre-commit hook + full-history scan. Regex/entropy based, fully offline, sub-second on a diff, MIT.           |
| [**TruffleHog**](https://github.com/trufflesecurity/trufflehog) `--results=verified` | Weekly deep pass. Verifies whether a matched credential is _live_, which collapses triage to confirmed leaks. |

The established split: **Gitleaks at the edge for speed, TruffleHog on a schedule for verified
confidence** ([AppSec Santa benchmark](https://appsecsanta.com/secret-scanning-tools/gitleaks-vs-trufflehog)).
We already have Husky + lint-staged, so the pre-commit hook is a two-line addition.

### L3 — Code (SAST)

| Tool                                                                                                | Role                                                                                                                       |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [**Semgrep CE**](https://semgrep.dev/) + `p/typescript`, `p/nodejs`, `p/owasp-top-ten`, `p/secrets` | Primary SAST. Fast (minutes on a large repo), custom rules in YAML, SARIF output, runs entirely locally.                   |
| `eslint-plugin-security`                                                                            | Lightweight in-editor SAST: `eval`, non-literal `require`, ReDoS, object injection. Slots into our existing ESLint config. |
| **Custom Semgrep rules**                                                                            | Portlog-specific invariants — see below.                                                                                   |

Why Semgrep over the alternatives: CodeQL's Datalog engine traces multi-hop dataflow better, but
it is **free only for public repos on GitHub, and requires a paid GHAS license for private ones**;
Snyk Code ships source to Snyk's cloud, which is disqualifying for self-hosted CI and has no custom
rules; SonarQube CE is heavier and Java-oriented
([Konvu](https://konvu.com/compare/semgrep-vs-codeql), [Rafter](https://rafter.so/blog/static-code-analysis-tools-comparison)).
Semgrep CE's free tier covers up to 10 contributors — we are one.

The custom-rule capability is what makes this worth more than a generic scanner. Rules worth writing
for our Golden Rules and domain stakes:

- A Prisma write on a document entity that bypasses the service layer.
- A controller method with no `@Roles()` / guard decorator.
- `new Date()` / `getHours()` used in a formatter path (TZ correctness is load-bearing).
- Raw `$queryRawUnsafe` anywhere.
- `console.log` in `backend/src` (bypasses pino redaction).

### L4 — Config, containers, IaC

| Tool                                                                                        | Role                                                                                                          |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| [**Trivy**](https://github.com/aquasecurity/trivy)                                          | All-in-one: image CVEs, filesystem, misconfig (Dockerfile/compose), secrets, licences, SBOM. Primary scanner. |
| [**Syft**](https://github.com/anchore/syft) + [**Grype**](https://github.com/anchore/grype) | SBOM as a durable artifact (CycloneDX) + a second-opinion CVE match on the built images.                      |
| [**hadolint**](https://github.com/hadolint/hadolint)                                        | Dockerfile linting.                                                                                           |

The documented pattern is **Trivy as primary, Grype as second opinion on critical images, Syft
generating one shared SBOM for both** — the CVE coverage of the two scanners differs enough that
running both widens real detection ([DevSecOps.ae](https://devsecops.ae/trivy-vs-grype/),
[AppSec Santa](https://appsecsanta.com/sca-tools/syft-vs-trivy)). Both are Apache-2.0 and run in the
CI runner. Keeping the SBOM committed also gives us "which release contained package X at version Y"
retroactively, which is exactly the question asked the morning after a registry compromise.

### L5 — CI/CD pipeline

| Tool                                                  | Role                                                                                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [**zizmor**](https://docs.zizmor.sh/audits/)          | Security linter for GitHub Actions: unpinned actions, template injection, excessive `GITHUB_TOKEN` permissions, known-vulnerable actions. |
| [**actionlint**](https://github.com/rhysd/actionlint) | Correctness: expression typing, shell syntax inside `run:`, invalid inputs.                                                               |

They are complements, not substitutes — **actionlint catches correctness, zizmor catches security**
([Schoettle](https://mattsch.com/blog/2026/03/28/harden-your-github-actions-workflows-with-zizmor-dependency-pinning-and-dependency-cooldowns/)).
Both matter more than usual here because `deploy.yml` holds an SSH key to production.

Baseline hardening they will flag: `permissions: {}` at workflow level with per-job grants, and
SHA-pinned actions (a tag is mutable; a SHA is cryptographic assurance you are running the code you
reviewed).

### L6 — Runtime / server exposure

Run _against_ `167.233.48.84`, from outside. Nothing here needs repo access.

| Tool                                                                                       | Role                                                                                            |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `nmap -sV --top-ports 1000`                                                                | What is actually listening. The single most valuable weekly check for a self-managed box.       |
| [**ssh-audit**](https://github.com/jtesta/ssh-audit)                                       | SSH algorithm/config hardening, known CVEs.                                                     |
| [**testssl.sh**](https://testssl.sh/)                                                      | TLS protocols, ciphers, cert expiry, crypto flaws. Pure bash, no install.                       |
| [**Nuclei**](https://github.com/projectdiscovery/nuclei)                                   | 11k+ templates for known-vulnerable exposed services and misconfigurations.                     |
| [**ZAP baseline**](https://www.zaproxy.org/docs/docker/baseline-scan/) (`zap-baseline.py`) | Passive DAST: missing security headers, cookie flags, info leaks. Read-only, safe against prod. |

**ZAP and Nuclei together are the strongest free DAST pairing** — Nuclei answers "is anything
publicly known-vulnerable exposed?", ZAP answers "does the app fail standard dynamic checks?"
([AppSec Santa](https://appsecsanta.com/dast-tools/free-dast-tools)). Use ZAP **baseline** (passive,
2–5 min) against production; never the active scan — that one writes.

### L7 — App semantics (the agent's own work)

No scanner covers these; they come from reading our code against our rules:

- **Env vars**: every var in `.env.example` validated at startup (Zod), no `process.env` reads
  scattered outside a typed config object, no secret with a shipped default that still says
  `change_me_in_production`. OWASP's caution applies: an env var is readable by any process under
  the same user and visible in `/proc/<pid>/environ`, so "it's in an env var" is not "it's secure".
- **Logging**: `redact` paths in `app.module.ts` still cover every sensitive field we have added
  since. Pino's redaction happens during serialization, before anything is written — but only for
  paths you list. Fields commonly forgotten: `req.headers.cookie`, `res.headers["set-cookie"]`,
  `*.secret`, `*.apiKey`, `req.body.email` if PII matters.
  Rule of thumb: never log raw request/response bodies in production, log structured metadata.
- **Authz**: every controller route has an explicit role guard; no `OPS` route mutates `ADM`-only data.
- **Cookies/JWT**: `httpOnly`, `secure`, `sameSite`, and an explicitly pinned JWT algorithm —
  leaving `algorithms` unset is how `alg: none` and RS256→HS256 confusion still land in 2026.
- **Rate limits**: auth routes tightened below the global default (typical baseline: ~100 req/15 min
  general, ~10 req/15 min on auth).

---

## 4. Explicitly rejected (and why)

Following STACK.md's convention of writing down the roads not taken:

| Rejected                        | Reason                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Snyk** (any product)          | Free tier is metered (100 SAST tests/mo); Snyk Code uploads source to their cloud; no custom rules.                                     |
| **CodeQL / GHAS**               | Free only for public repos; $30/committer/mo if we ever go private. Semgrep gives us 80% of the value with custom rules and no lock-in. |
| **SonarQube CE**                | Heavier to self-host, strongest on Java, overlaps Semgrep for TS.                                                                       |
| **ZAP active scan**             | Sends mutating requests. Unacceptable against a production system generating legally binding documents.                                 |
| **HashiCorp Vault / Infisical** | Correct at 50 engineers; overkill at one. SOPS+age is the right size if we outgrow `.env`.                                              |
| **Commercial ASPM/CNAPP**       | Cost has no relationship to a 10-user single-box deployment.                                                                            |

---

## 5. Cadence — what runs when

Not everything belongs in the weekly job. Splitting by cost keeps the fast loop fast:

| When               | What                                                                                                                                                                                                   | Budget     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| Pre-commit (Husky) | Gitleaks on staged diff                                                                                                                                                                                | < 1 s      |
| Every PR (CI)      | `npm audit`, Semgrep CE, actionlint, zizmor, hadolint                                                                                                                                                  | ~2–4 min   |
| **Weekly (Orca)**  | Everything: TruffleHog verified, OSV-Scanner, Trivy + Syft/Grype on built images, full-history Gitleaks, nmap + ssh-audit + testssl + Nuclei + ZAP baseline against prod, **plus the L7 agent review** | ~15–30 min |
| Quarterly (manual) | Secret rotation, dependency major bumps, restore-from-backup drill                                                                                                                                     | —          |

---

## 6. Repo layout

Built (`✅`) and still to build (`▫️`):

```
✅ security/
     run-scanners.sh                # deterministic scanner pass (L1–L5, L7 probes; L6 opt-in)
     finding-id.sh                  # stable finding IDs, so reports diff week to week
     tools.env                      # container image refs — everything runs via docker
     targets.env.example            # copy to targets.env to enable --prod scans (gitignored)
     baselines/accepted.json        # accepted findings: reason + expiry, not a mute button
     reports/
       SUMMARY.md                   # latest triaged report (tracked)
       <date>/                      # raw artifacts + coverage.json (gitignored)
✅ ~/.claude/skills/security-audit/  # /security-audit — triage, manual layer, report. Never fixes.
     SKILL.md
     references/manual-checks.md    # the 14 checks no scanner performs
     references/report-template.md  # fixed report shape
✅ ~/.claude/skills/audit-fix/       # /audit-fix — the remediation half. Never audits.
     SKILL.md
     references/verification.md     # proof-of-closure per layer + the fixes that can take prod down
▫️ .npmrc                            # min-release-age=7
▫️ .semgrep/portlog-rules.yml        # custom rules from L3
▫️ .gitleaks.toml                    # allowlist: docs/, *.example, test fixtures
▫️ .github/workflows/security.yml    # the per-PR subset
```

No scanner is installed natively on the dev machine, so **every tool runs through Docker**. That
turned out to be the right call anyway: the image ref is the version pin, and `run-scanners.sh`
records each resolved digest into `coverage.json`, so any report can be traced to the exact
scanner build that produced it.

`run-scanners.sh` design rules, so the weekly job stays trustworthy:

1. **Never fail the whole run on one tool.** Each scanner writes its artifact; the script collects
   exit codes and continues. A missing binary is a warning, not an abort.
2. **Everything emits SARIF or JSON** into `reports/<date>/`. SARIF is what GitHub, GitLab and
   triage tooling ingest, and it is the format the 2026 agentic-SAST harnesses standardized on.
3. **Baselines, not suppressions-in-code.** A triaged finding goes in `security/baselines/` with a
   reason and an expiry date. Anything past expiry re-surfaces.
4. **Prod-facing scans are read-only** and gated behind `targets.env` being present, so the script
   is safe to run from a laptop by accident.
5. **Report is the deliverable**, not the exit code. `SUMMARY.md` = new since last week / still open
   / closed since last week — a plain diff, so a quiet week reads as one line.

---

## 7. Wiring it to a weekly Orca automation

Orca automations run a prompt on a schedule in a **headless, ephemeral worktree**, with cron/RRULE
support, IANA timezones, optional prechecks, and per-run history
([Orca CLI docs](https://www.onorca.dev/docs/cli/overview),
[automations architecture](https://deepwiki.com/stablyai/orca/2.7-automations-and-orchestration)).
That maps onto this job cleanly: it is scheduled, it is read-mostly, and its output is a file plus a
summary.

```bash
# Create it disabled first — never let an unproven automation run unattended.
orca automations create \
  --name "Weekly security audit" \
  --trigger weekly \
  --time 07:15 \
  --timezone America/Caracas \
  --provider claude \
  --repo portlog \
  --precheck "command -v trivy && command -v semgrep && command -v gitleaks" \
  --prompt "Run the security-audit skill: execute security/run-audit.sh, triage the artifacts in security/reports/<date>/ against the baselines, and write security/reports/SUMMARY.md as new / still-open / closed-since-last-week. Open a PR only if a HIGH or CRITICAL finding is new. Do not modify application code." \
  --disabled

orca automations run <automationId>          # dry run, inspect the output
orca automations runs <automationId>         # check history
orca automations edit <automationId> --enabled
```

Notes specific to this machine:

- **`orca` on PATH is not Orca IDE.** `/usr/bin/orca` is the GNOME screen reader (a Python script).
  The Orca CLI is not currently installed — install it from the Orca app and confirm
  `command -v orca` resolves to it (or invoke it by absolute path in scripts) before relying on any
  of the commands above. Orca IDE itself is installed (`~/.config/orca`, `~/.orca/agent-hooks`).
- **Automations only run while the machine is on.** This is a laptop-scheduled job, not a cloud
  cron. If the box is off Sunday morning, `--missed-run-grace-minutes` decides whether it still
  fires. For a weekly job, set it generously (e.g. 720).
- **Use `--precheck`** to skip cleanly when the scanner binaries are missing, instead of burning a
  run to produce an error report.
- **Fresh session, not `--reuse-session`.** Each audit should start from a clean context; carrying
  last week's conversation biases the triage.
- Schedule it **07:15, not 07:00** — off-the-hour scheduling avoids the global thundering herd, and
  nothing here is time-critical.

Guardrails for the prompt, given the agent runs unattended:

- Read-only with respect to `backend/src`, `frontend/src`, `packages/` — the audit reports, it does
  not patch. Fixes are a separate, reviewed session.
- Writes are confined to `security/reports/**`.
- Opening a PR (not pushing to `main`) is the escalation path, and only for new HIGH/CRITICAL.
- Never paste a discovered secret value into the report — reference `file:line` and the rule ID.

### On skills

Claude Code already ships a built-in **`/security-review`** skill, but it reviews _the pending diff
on the current branch_ — it is a PR-time reviewer, not a whole-repo auditor. It complements this
job; it does not replace it. The repo-local `.claude/skills/security-audit/SKILL.md` is what
encodes the L7 checklist, the baseline format, and the report structure so the weekly run is
reproducible rather than improvised.

⚠️ **`.claude` is currently in `.gitignore`**, so nothing under it is version-controlled (`git
ls-files .claude` → 0 files). To ship the skill with the repo, un-ignore the parts that are project
assets (`.claude/skills/`, `.claude/agents/`) while keeping local state ignored.

---

## 8. First-pass findings, 2026-08-08

Found by hand while scoping this doc — i.e. what week one of the automation would report anyway.
Not yet fixed.

| #   | Sev      | Finding                                                                                                                                                                                                                                                                                                | Where                                              |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | **High** | MinIO publishes `9000:9000` and `9001:9001` on all interfaces — the S3 API _and_ the admin console are reachable from the internet, protected only by `MINIO_ROOT_*`. Nothing else in the stack does this (postgres correctly uses `expose:`). Should be `expose:` + proxied, or bound to `127.0.0.1`. | `docker-compose.yml:80-82`                         |
| 2   | **High** | `npm audit --omit=dev`: 12 vulnerabilities in production dependencies (1 critical, 9 high), including a `ws` memory-exhaustion DoS. Most have fixes available.                                                                                                                                         | root                                               |
| 3   | **Med**  | No `helmet` / security headers anywhere — not in the Fastify app, not in the nginx config. No HSTS, CSP, `X-Content-Type-Options`, or `Referrer-Policy`.                                                                                                                                               | `backend/src/main.ts`, `nginx/conf.d/portlog.conf` |
| 4   | **Med**  | CI workflows declare no `permissions:` block, so jobs inherit the repo default token scope; actions are pinned to mutable tags (`actions/checkout@v4`) rather than SHAs. `deploy.yml` holds a production SSH key.                                                                                      | `.github/workflows/*.yml`                          |
| 5   | **Med**  | `minio/minio:latest` is an unpinned tag — the deployed image can change under us on any `docker compose build`.                                                                                                                                                                                        | `docker-compose.yml:78`                            |
| 6   | **Low**  | `CORS_ORIGIN` falls back to a `localhost` regex when unset. Correct for dev, but a production deploy that forgets the var gets a silently permissive-ish default instead of a hard failure.                                                                                                            | `backend/src/main.ts:44`                           |
| 7   | **Low**  | pino `redact` covers passwords/tokens/hashes but not `req.headers.cookie` or `res.headers["set-cookie"]` — a session cookie can reach the logs via the headers object.                                                                                                                                 | `backend/src/app.module.ts:60-67`                  |
| 8   | **Low**  | `.env` is mode `0664` (group-readable) on the dev machine; `0600` is the norm for a file holding live credentials.                                                                                                                                                                                     | `.env`                                             |
| 9   | **Info** | `min-release-age` is available on our npm (11.13.0) and unset. One line in `.npmrc`.                                                                                                                                                                                                                   | `.npmrc` (absent)                                  |

Item 4 is partly mitigated by design: the deploy key is pinned in `authorized_keys` to a forced
command, so leaking it buys a redeploy of `main` rather than a shell — that reasoning is already
documented in `deploy.yml` and holds up.

---

## Sources

- [Best 16 Open Source AppSec Tools for 2026 — Orca Security](https://orca.security/resources/blog/open-source-application-security-tools/)
- [Open Source SAST Tools: 9 Free Scanners Compared (2026) — AppSec Santa](https://appsecsanta.com/sast-tools/open-source-sast-tools)
- [Semgrep vs CodeQL: A Deep Technical Comparison (2026) — Konvu](https://konvu.com/compare/semgrep-vs-codeql)
- [Static Code Analysis Tools Comparison — Rafter](https://rafter.so/blog/static-code-analysis-tools-comparison)
- [Gitleaks vs TruffleHog 2026: Secret Scanner Benchmarks — AppSec Santa](https://appsecsanta.com/secret-scanning-tools/gitleaks-vs-trufflehog)
- [Trivy vs Grype: Which Container Vulnerability Scanner in 2026 — NomadX](https://devsecops.ae/trivy-vs-grype/)
- [Syft vs Trivy 2026: SBOM Generator vs Unified Scanner — AppSec Santa](https://appsecsanta.com/sca-tools/syft-vs-trivy)
- [Free & Open-Source DAST Tools Compared (2026) — AppSec Santa](https://appsecsanta.com/dast-tools/free-dast-tools)
- [zizmor audit rules](https://docs.zizmor.sh/audits/) · [Harden your GitHub Actions Workflows — Matthias Schoettle](https://mattsch.com/blog/2026/03/28/harden-your-github-actions-workflows-with-zizmor-dependency-pinning-and-dependency-cooldowns/)
- [npm introduces minimumReleaseAge — Socket](https://socket.dev/blog/npm-introduces-minimumreleaseage-and-bulk-oidc-configuration) · [Dependency Cooldowns](https://cooldowns.dev/)
- [npm Supply Chain Security in 2026 — Mondoo](https://mondoo.com/blog/npm-supply-chain-security-package-manager-defenses-2026)
- [OWASP Secrets Management & Environment Variables Best Practices — AquilaX](https://aquilax.ai/blog/owasp-secrets-management-environment-variables)
- [Best Logging Practices for Safeguarding Sensitive Data — Better Stack](https://betterstack.com/community/guides/logging/sensitive-data/) · [Redacting Secrets from Pino Logs](https://lepape.me/nodejs-best-practices-redacting-secrets-from-pino-logs/)
- [OWASP Secure Coding Checklist for Node/Express APIs 2026](https://dev.to/securitystefan/owasp-secure-coding-checklist-for-node-express-apis-2026-1505)
- [ssh-audit](https://github.com/jtesta/ssh-audit) · [testssl.sh](https://testssl.sh/) · [OpenSSF Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md)
- [Orca CLI overview](https://www.onorca.dev/docs/cli/overview) · [Orca automations & orchestration](https://deepwiki.com/stablyai/orca/2.7-automations-and-orchestration)
- [Comparing Open-Source AI Code Security Harnesses — Semgrep](https://semgrep.dev/blog/2026/comparing-open-source-ai-code-security-harnesses/)
