# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository State

Documentation-only. No `backend/`, `frontend/`, or `package.json` exists yet — the first implementation work will scaffold them per the docs. Until then, there is nothing to build, lint, or test.

## Documentation Map

Read the relevant doc before acting in its area; do not re-derive what's already written.

- [docs/STACK.md](docs/STACK.md) — master stack reference, **the 10 Golden Rules** (load-bearing), explicitly rejected alternatives, milestone mapping. Read this first for any architectural decision.
- [docs/SCOPE.md](docs/SCOPE.md) — living module map (14 modules across foundation/core/operational/comms/cross-cutting), per-module purpose, entities, workflows, and **Open Questions** to resolve.
- [docs/FRONTEND.md](docs/FRONTEND.md) — SPA rationale, project structure, routing/query/form patterns, end-to-end type chain, bundle targets.
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Dockerfiles, `docker-compose.yml`, Nginx config, env vars, prod checklist, backup/DR.
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — daily commands (backend, frontend, Prisma, Neon, Docker, testing), debugging, common gotchas.

## Domain Stakes

Portlog generates legally binding port documents (PEDR, SOF, NOR, SH-xx). Wrong timestamps and malformed notices have real financial/regulatory consequences. The Golden Rules in STACK.md exist to protect data integrity — treat them as non-negotiable, not stylistic preferences.

Two roles: `OPS`, `ADM`. ~10 users, ~30 screens, ~22 forms, ~40 tables.

## What's Not in the Docs (and worth knowing here)

- The repo is a planned monorepo (`backend/` + `frontend/`); current `README.md` is a stub.
- When the docs disagree with code that already exists, the docs are aspirational — verify against the code and flag the drift rather than silently following either.
