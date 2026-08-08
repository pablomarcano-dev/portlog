#!/usr/bin/env bash
#
# Stable finding IDs.
#
# Week-over-week diffing only works if the same underlying problem gets the same
# ID every run. Sequential numbering breaks the moment a finding is fixed and the
# rest shift up; hashing the identity of the finding does not.
#
# The hash deliberately excludes line numbers and severity: an unrelated edit
# above a finding, or a re-rating during triage, must not turn one finding into
# two. Path + rule + symbol is the coarsest thing that still distinguishes two
# genuinely different problems.
#
# Usage:  ./security/finding-id.sh <layer> <rule> <path> [symbol]
# Example: ./security/finding-id.sh L4 exposed-port docker-compose.yml minio
#          -> PL-L4-3f9a1c2d

set -euo pipefail

if [ $# -lt 3 ]; then
  echo "usage: $0 <layer> <rule> <path> [symbol]" >&2
  exit 2
fi

layer="$1"; rule="$2"; path="$3"; symbol="${4:-}"
hash="$(printf '%s|%s|%s' "$rule" "$path" "$symbol" | sha1sum | cut -c1-8)"
printf 'PL-%s-%s\n' "$layer" "$hash"
