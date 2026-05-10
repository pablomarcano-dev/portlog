# portlog

Internal port agency operations platform. Generates legally binding port documents (PEDR, SOF, NOR, SH-xx).

## Requirements

- Node.js 20 (LTS) — use `nvm use` to activate `.nvmrc`
- npm 10+

## Quick start

```bash
# Install all workspace dependencies from repo root
npm install

# Start all services concurrently (schemas watch + backend :3000 + frontend :5173)
npm run dev
```

## Workspaces

| Workspace          | Package             | Purpose                                                    |
| ------------------ | ------------------- | ---------------------------------------------------------- |
| `packages/schemas` | `@portlog/schemas`  | Shared Zod schemas (single source of truth for validation) |
| `backend`          | `@portlog/backend`  | NestJS API on port 3000                                    |
| `frontend`         | `@portlog/frontend` | React + Vite SPA on port 5173                              |

## Common commands

```bash
# Type-check all workspaces
npm run typecheck

# Lint all workspaces
npm run lint

# Build all workspaces
npm run build

# Format with Prettier
npm run format
```

## Prisma (backend)

```bash
# Generate Prisma client after schema changes
npm run -w @portlog/backend prisma generate

# Create and apply a migration
npm run -w @portlog/backend prisma migrate dev --name <migration-name>
```

## Pre-commit hook

Husky + lint-staged runs ESLint and Prettier on staged `.ts/.tsx` files before every commit. A lint error will block the commit.
