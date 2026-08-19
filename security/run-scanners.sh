#!/usr/bin/env bash
#
# Portlog security audit — deterministic scanner pass.
#
# Runs every mechanical check and drops raw artifacts into
# security/reports/<date>/. It does NOT triage, rank, or summarise: that is the
# agent's job (see .claude/skills/security-audit/SKILL.md). Keeping the two
# separate is what makes the audit reproducible — the machine part always does
# the same thing in the same order, so any difference between two weeks is a
# real change in the codebase rather than a change in how it was scanned.
#
# Design rules:
#   1. One failing scanner never aborts the run. Every tool records its own
#      status in coverage.json and the run continues.
#   2. A missing tool is reported, never silently skipped. A clean report that
#      only looks clean because semgrep failed to pull is worse than no report.
#   3. Containers write to stdout; the host redirects to a file. This avoids
#      root-owned artifacts and keeps the repo mounted read-only.
#
# Usage:
#   ./security/run-scanners.sh            # full local pass (needs docker)
#   ./security/run-scanners.sh --quick    # no docker: npm audit + grep checks
#   ./security/run-scanners.sh --prod     # adds network scans against targets.env
#   ./security/run-scanners.sh --out DIR  # override the output directory

set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO" || exit 1

# shellcheck source=/dev/null
source "$REPO/security/tools.env"

RUN_DATE="$(date +%Y-%m-%d)"
OUT="$REPO/security/reports/$RUN_DATE"
QUICK=0
PROD=0

while [ $# -gt 0 ]; do
  case "$1" in
    --quick) QUICK=1 ;;
    --prod)  PROD=1 ;;
    --out)   OUT="$2"; shift ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
  shift
done

mkdir -p "$OUT"
COVERAGE="$OUT/coverage.json"
: > "$OUT/.coverage.tmp"

log() { printf '  %s\n' "$*"; }
hr()  { printf '\n== %s ==\n' "$*"; }

# record <tool> <layer> <status> <exit_code> <artifact> <note>
record() {
  printf '{"tool":"%s","layer":"%s","status":"%s","exit_code":%s,"artifact":"%s","note":"%s"}\n' \
    "$1" "$2" "$3" "$4" "$5" "$6" >> "$OUT/.coverage.tmp"
}

have_docker() { command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; }

# Pull once up front and record the digest, so the report can name the exact
# scanner build. A floating tag that silently moved is otherwise invisible.
pull() {
  local img="$1"
  if ! docker image inspect "$img" >/dev/null 2>&1; then
    # stderr, not stdout: this function's stdout is captured as the digest, so a
    # progress line here ends up inside coverage.json's note field.
    log "pulling $img" >&2
    docker pull --quiet "$img" >/dev/null 2>&1 || return 1
  fi
  docker image inspect --format '{{index .RepoDigests 0}}' "$img" 2>/dev/null \
    || echo "$img (no digest)"
}

# dscan <name> <layer> <image> <artifact> -- <args...>
# Runs a container with the repo mounted read-only, capturing stdout as the
# artifact and stderr as a sibling .log.
dscan() {
  local name="$1" layer="$2" img="$3" artifact="$4"; shift 5
  if [ "$QUICK" = 1 ]; then
    record "$name" "$layer" "skipped" 0 "" "--quick: docker scanners not run"
    return
  fi
  if ! have_docker; then
    record "$name" "$layer" "unavailable" 0 "" "docker not available"
    log "SKIP $name (no docker)"
    return
  fi
  local digest; digest="$(pull "$img")" || {
    record "$name" "$layer" "error" 1 "" "image pull failed: $img"
    log "FAIL $name (pull)"
    return
  }
  log "running $name"
  docker run --rm -v "$REPO:/repo:ro" -w /repo "$img" "$@" \
    > "$OUT/$artifact" 2> "$OUT/${artifact%.json}.log"
  local rc=$?
  # Most of these tools exit 1 to mean "ran fine, found something" — treating
  # that as an error would hide the very findings we asked for. Anything above 1
  # is a real failure and has to show up in the coverage table as one.
  local status
  case "$rc" in
    0) status="ok" ;;
    1) status="findings" ;;
    *) status="error" ;;
  esac
  record "$name" "$layer" "$status" "$rc" "$artifact" "$digest"
}

echo "Portlog security audit — $RUN_DATE"
echo "output: $OUT"
[ "$QUICK" = 1 ] && echo "mode: quick (no docker)"

# ---------------------------------------------------------------------------
# L1 — dependencies and supply chain
# ---------------------------------------------------------------------------
hr "L1 dependencies"

log "npm audit (production deps)"
npm audit --omit=dev --json > "$OUT/npm-audit-prod.json" 2>"$OUT/npm-audit-prod.log"
record "npm-audit-prod" "L1" "ok" $? "npm-audit-prod.json" "production dependency tree"

log "npm audit (all deps)"
npm audit --json > "$OUT/npm-audit-all.json" 2>/dev/null
record "npm-audit-all" "L1" "ok" $? "npm-audit-all.json" "includes devDependencies"

# Provenance/signature verification. Advisory only — npm does not enforce this
# at install time, so a package that quietly dropped provenance still installs.
log "npm audit signatures"
npm audit signatures > "$OUT/npm-signatures.txt" 2>&1
record "npm-signatures" "L1" "ok" $? "npm-signatures.txt" "registry signature/provenance check"

# Dependency cooldown: available from npm 11.10.0. Absence is itself a finding.
if grep -q "min-release-age" "$REPO/.npmrc" 2>/dev/null; then
  record "npm-cooldown" "L1" "ok" 0 "" "min-release-age configured"
else
  record "npm-cooldown" "L1" "finding" 1 "" "min-release-age not set in .npmrc"
fi

dscan osv-scanner L1 "$IMG_OSV" osv.json -- \
  scan source --lockfile=/repo/package-lock.json --format json

# ---------------------------------------------------------------------------
# L2 — secrets
# ---------------------------------------------------------------------------
hr "L2 secrets"

dscan gitleaks L2 "$IMG_GITLEAKS" gitleaks.json -- \
  detect --source=/repo --no-banner --redact \
  --report-format json --report-path /dev/stdout

# Verified-only: TruffleHog checks whether a matched credential is still live,
# which collapses triage from "every regex hit" to "credentials that actually work".
dscan trufflehog L2 "$IMG_TRUFFLEHOG" trufflehog.json -- \
  git file:///repo --json --results=verified --no-update

# ---------------------------------------------------------------------------
# L3 — code (SAST)
# ---------------------------------------------------------------------------
hr "L3 code"

SEMGREP_ARGS=(--json --quiet --metrics=off --error)
for cfg in $SEMGREP_CONFIGS; do SEMGREP_ARGS+=(--config="$cfg"); done
[ -d "$REPO/.semgrep" ] && SEMGREP_ARGS+=(--config=/repo/.semgrep)
dscan semgrep L3 "$IMG_SEMGREP" semgrep.json -- semgrep "${SEMGREP_ARGS[@]}" /repo

# ---------------------------------------------------------------------------
# L4 — config, containers, IaC
# ---------------------------------------------------------------------------
hr "L4 config and containers"

# Filesystem mode covers the lockfile, Dockerfiles, compose files and secrets in
# one pass — no image build required, so this works before a deploy.
# node_modules is skipped for misconfig purposes: vendored packages ship their own
# example Dockerfiles (getos alone contributes ~20 hits) and none of them are ours.
# Dependency CVEs still come from the lockfile, which trivy reads separately.
dscan trivy-fs L4 "$IMG_TRIVY" trivy-fs.json -- \
  fs --scanners vuln,misconfig,secret --format json --skip-dirs node_modules /repo

dscan syft L4 "$IMG_SYFT" sbom.cdx.json -- \
  scan dir:/repo -o cyclonedx-json

for df in backend/Dockerfile frontend/Dockerfile; do
  [ -f "$REPO/$df" ] || continue
  dscan "hadolint-$(dirname "$df")" L4 "$IMG_HADOLINT" \
    "hadolint-$(dirname "$df").json" -- hadolint -f json "/repo/$df"
done

# Grype reads the SBOM syft just produced — one inventory, two matchers.
if [ -s "$OUT/sbom.cdx.json" ] && [ "$QUICK" = 0 ] && have_docker; then
  digest="$(pull "$IMG_GRYPE")"
  log "running grype (against sbom)"
  docker run --rm -i "$IMG_GRYPE" -o json < "$OUT/sbom.cdx.json" \
    > "$OUT/grype.json" 2> "$OUT/grype.log"
  record "grype" "L4" "ok" $? "grype.json" "$digest"
else
  record "grype" "L4" "skipped" 0 "" "no sbom to scan"
fi

# ---------------------------------------------------------------------------
# L5 — CI/CD pipeline
# ---------------------------------------------------------------------------
# Deterministic greps rather than a container, so this layer always reports
# something even in --quick mode. zizmor is the deeper tool if you install it.
hr "L5 pipeline"

{
  echo "# workflow hardening probe"
  for wf in "$REPO"/.github/workflows/*.yml "$REPO"/.github/workflows/*.yaml; do
    [ -f "$wf" ] || continue
    echo "## $(basename "$wf")"
    if grep -q '^permissions:' "$wf"; then
      echo "permissions_block: present"
    else
      echo "permissions_block: MISSING (job inherits default token scope)"
    fi
    echo "unpinned_actions:"
    grep -nE 'uses:\s*[^@]+@(v?[0-9]+|main|master)\b' "$wf" || echo "  none"
    echo "risky_interpolation_in_run:"
    grep -nE 'run:.*\$\{\{\s*(github\.event|github\.head_ref|inputs\.)' "$wf" || echo "  none"
    echo
  done
} > "$OUT/workflow-probe.txt" 2>&1
record "workflow-probe" "L5" "ok" 0 "workflow-probe.txt" "permissions block, action pinning, injection"

# ---------------------------------------------------------------------------
# L7 — repo hygiene probes feeding the agent's manual review
# ---------------------------------------------------------------------------
hr "L7 hygiene probes"

# Paths stay relative throughout: an artifact full of /home/<user>/ prefixes
# diffs badly between machines and leaks the operator's username into a report
# that gets committed.
{
  echo "## .env file modes (0600 expected for files holding live credentials)"
  find . -maxdepth 2 \( -name '.env' -o \( -name '.env.*' ! -name '*.example' \) \) \
    -print0 2>/dev/null | xargs -0 -r ls -l

  echo
  echo "## keys in .env.example missing from .env (and vice versa)"
  echo "   '<' = in .env.example only    '>' = in .env only"
  if [ -f .env ] && [ -f .env.example ]; then
    diff <(grep -oE '^[A-Z_][A-Z0-9_]*' .env.example | sort -u) \
         <(grep -oE '^[A-Z_][A-Z0-9_]*' .env | sort -u) \
      || true
  fi

  echo
  echo "## placeholder secrets still in place"
  grep -rn "change_me\|changeme\|CHANGEME\|your_.*_here" \
    .env .env.example docker-compose.yml 2>/dev/null || echo "  none"

  echo
  echo "## published container ports (host-reachable services)"
  grep -nE "^\s+- '[0-9]+:[0-9]+'" docker-compose.yml 2>/dev/null || echo "  none"

  echo
  echo "## unpinned image tags"
  grep -nE 'image:\s*\S+:(latest|stable)?\s*$' docker-compose.yml 2>/dev/null || echo "  none"

  echo
  echo "## console.log in backend/src (bypasses pino redaction)"
  grep -rn "console\.\(log\|info\|debug\)" backend/src --include=*.ts 2>/dev/null || echo "  none"

  echo
  echo "## raw SQL"
  grep -rn '\$queryRawUnsafe\|\$executeRawUnsafe' backend/src --include=*.ts 2>/dev/null || echo "  none"

  echo
  echo "## pino redact paths currently configured"
  sed -n '/redact:/,/\]/p' backend/src/app.module.ts 2>/dev/null

  echo
  echo "## controllers with no @Roles and no @Public"
  undecorated=""
  while IFS= read -r f; do
    grep -q "@Roles\|@Public" "$f" || undecorated="$undecorated  $f"$'\n'
  done < <(find backend/src -name '*.controller.ts' | sort)
  printf '%s' "${undecorated:-  none$'\n'}"

  echo
  echo "## @Public() routes (unauthenticated entry points)"
  grep -rn "@Public()" backend/src --include=*.ts 2>/dev/null || echo "  none"

  echo
  echo "## process.env reads outside a typed config"
  grep -rn "process\.env\[" backend/src --include=*.ts 2>/dev/null | grep -v config || echo "  none"

  echo
  echo "## security headers (helmet / nginx add_header)"
  grep -rn "helmet" backend/src backend/package.json 2>/dev/null || echo "  helmet: not used"
  grep -rn "add_header" nginx/conf.d/*.conf 2>/dev/null || echo "  nginx add_header: none"
} > "$OUT/hygiene.txt" 2>&1
record "hygiene-probe" "L7" "ok" 0 "hygiene.txt" "env, logging, authz, headers, ports"

# ---------------------------------------------------------------------------
# L6 — runtime exposure (opt-in, network-active, read-only)
# ---------------------------------------------------------------------------
if [ "$PROD" = 1 ]; then
  hr "L6 runtime exposure"
  if [ ! -f "$REPO/security/targets.env" ]; then
    record "prod-scans" "L6" "unavailable" 1 "" "security/targets.env missing"
    log "SKIP: no targets.env (copy targets.env.example)"
  else
    # shellcheck source=/dev/null
    source "$REPO/security/targets.env"
    dscan nmap L6 "$IMG_NMAP" nmap.txt -- \
      -sV -Pn --top-ports 1000 "$PROD_HOST"
    dscan testssl L6 "$IMG_TESTSSL" testssl.json -- \
      --jsonfile /dev/stdout --quiet --color 0 "$PROD_URL"
    dscan nuclei L6 "$IMG_NUCLEI" nuclei.json -- \
      -u "$PROD_URL" -jsonl -silent -severity medium,high,critical
    # ZAP *baseline* only: passive, no mutating requests. See targets.env.example.
    dscan zap-baseline L6 "$IMG_ZAP" zap.json -- \
      zap-baseline.py -t "$PROD_URL" -J /dev/stdout -I
  fi
else
  record "prod-scans" "L6" "skipped" 0 "" "not requested (--prod)"
fi

# ---------------------------------------------------------------------------
# Coverage manifest
# ---------------------------------------------------------------------------
{
  printf '{\n  "run_date": "%s",\n  "mode": "%s",\n  "repo_head": "%s",\n  "tools": [\n' \
    "$RUN_DATE" \
    "$([ "$QUICK" = 1 ] && echo quick || echo full)$([ "$PROD" = 1 ] && echo '+prod')" \
    "$(git -C "$REPO" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  paste -sd, - < "$OUT/.coverage.tmp"
  printf '  ]\n}\n'
} > "$COVERAGE"
rm -f "$OUT/.coverage.tmp"

hr "coverage"
if command -v jq >/dev/null 2>&1; then
  jq -r '.tools[] | "  \(.status)\t\(.tool)\t\(.note)"' "$COVERAGE" 2>/dev/null \
    || cat "$COVERAGE"
else
  cat "$COVERAGE"
fi

echo
echo "artifacts: $OUT"
echo "next: triage with the security-audit skill (/security-audit)"
