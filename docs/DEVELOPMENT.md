# Portlog — Development Commands

> Daily commands and workflows for local development.
> Companion document to [STACK.md](./STACK.md).

---

## Initial Setup

### Prerequisites

```bash
# Node.js 20+ (use nvm or volta)
node --version    # >= 20.0.0
npm --version     # >= 10.0.0

# Docker for local services
docker --version  # >= 24.0.0

# Neon CLI (optional but recommended)
npm install -g neonctl
neonctl auth
```

### First-time clone

```bash
git clone <repo-url> portlog
cd portlog

# Install dependencies (both projects if monorepo)
cd backend && npm install
cd ../frontend && npm install
cd ..

# Copy environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
# Fill in .env values (ask team for dev secrets)

# Generate Prisma client
cd backend && npx prisma generate

# Apply migrations to local dev branch
npx prisma migrate dev

# Seed initial data
npm run seed
```

---

## Daily Development Workflow

### Backend

```bash
cd backend

# Start dev server (watch mode + auto-reload)
npm run start:dev

# Run on a specific port
PORT=3001 npm run start:dev

# Type check without building
npx tsc --noEmit

# Lint
npm run lint
npm run lint:fix

# Format
npm run format
```

### Frontend

```bash
cd frontend

# Start Vite dev server (default :5173)
npm run dev

# Bind to all interfaces (for testing on phone, etc.)
npm run dev -- --host

# Type check
npx tsc --noEmit

# Lint
npm run lint
npm run lint:fix

# Build production bundle locally
npm run build
npm run preview      # Serve the production build locally
```

### Run both simultaneously

If using a monorepo with workspaces, from the root:

```bash
npm run dev          # Runs backend + frontend in parallel
```

Otherwise, two terminal tabs.

---

## NestJS CLI

### Generate resources

```bash
# Full CRUD resource (module + controller + service + DTOs)
nest g resource <name>

# Examples for Portlog:
nest g resource owners
nest g resource ports
nest g resource ship-particulars

# Individual pieces
nest g module <name>
nest g controller <name>
nest g service <name>
nest g class <name>/dto/create-<name>.dto
nest g guard auth/roles
```

### Common patterns

```bash
# Generate a guard
nest g guard auth/jwt-auth

# Generate a custom decorator (manual)
# Place in src/auth/decorators/roles.decorator.ts

# Generate a pipe
nest g pipe common/zod-validation
```

---

## Prisma

### Schema and migrations

```bash
cd backend

# After editing schema.prisma:
npx prisma format                    # Auto-format the schema
npx prisma validate                  # Validate without DB roundtrip

# Create + apply a new migration in dev
npx prisma migrate dev --name add_nominations_status

# Reset local DB (drops everything, reapplies migrations, runs seed)
npx prisma migrate reset

# Apply pending migrations (production / CI)
npx prisma migrate deploy

# Regenerate the client after schema changes
npx prisma generate

# View migration status
npx prisma migrate status
```

### Querying and inspection

```bash
# Open Prisma Studio (GUI for the DB)
npx prisma studio

# Pull schema from existing DB (for introspection scenarios)
npx prisma db pull

# Push schema without migration (DEV ONLY — never in production)
npx prisma db push
```

### Seeding

`backend/prisma/seed.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPassword = await bcrypt.hash('change-me', 10);

  await prisma.user.upsert({
    where: { email: 'admin@portlog.local' },
    update: {},
    create: {
      email: 'admin@portlog.local',
      password: adminPassword,
      role: 'ADM',
      name: 'Admin User',
    },
  });

  // Add other seed data: ports, flags, default master data, etc.
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

```bash
# Run the seed
npx prisma db seed

# Configure in package.json:
# "prisma": { "seed": "ts-node prisma/seed.ts" }
```

---

## Neon CLI — Database Branching

```bash
# List projects
neonctl projects list

# List branches in current project
neonctl branches list

# Create a branch from main (for a feature)
neonctl branches create --name feature/sof-improvements --parent main

# Get connection string for a branch
neonctl connection-string feature/sof-improvements

# Delete a branch when done
neonctl branches delete feature/sof-improvements

# Reset a branch to its parent's current state
neonctl branches reset feature/sof-improvements --parent main
```

### Recommended workflow for migrations

```bash
# 1. Create a Neon branch for the migration work
neonctl branches create --name migration-add-services

# 2. Update local .env to point to the new branch
neonctl connection-string migration-add-services
# Copy URL to .env DATABASE_URL and DIRECT_URL

# 3. Develop and test the migration locally
npx prisma migrate dev --name add_services_table

# 4. When merged, the migration applies to main on next deploy

# 5. Clean up
neonctl branches delete migration-add-services
```

---

## Docker

### Local development with services

If running Postgres locally instead of Neon (alternative dev setup):

```bash
# Start only the local services (without backend/frontend)
docker compose -f docker-compose.dev.yml up -d postgres minio

# Stop them
docker compose -f docker-compose.dev.yml down

# Reset (delete volumes)
docker compose -f docker-compose.dev.yml down -v
```

### Production-like local testing

```bash
# Build everything
docker compose build

# Start the full stack
docker compose up -d

# View logs (all services)
docker compose logs -f

# View logs for one service
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Tear down
docker compose down

# Tear down + remove volumes (full reset)
docker compose down -v
```

### Inspecting containers

```bash
# Shell into a running container
docker compose exec backend sh
docker compose exec minio sh

# Run a one-off command
docker compose exec backend npx prisma migrate status
docker compose run --rm backend npm run typeorm:migration:run

# Resource usage
docker stats
```

---

## MinIO Console

Local MinIO admin console:

```
http://localhost:9001
```

Login with the credentials from `.env` (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`).

CLI access via `mc`:

```bash
# Inside the minio container
docker compose exec minio sh

mc alias set local http://localhost:9000 portlog changeme

# List buckets
mc ls local/

# List files in the SGC bucket
mc ls --recursive local/sgc-documents/

# Upload a test file
mc cp /tmp/test.pdf local/sgc-documents/test.pdf

# Set lifecycle policy (e.g., expire after 1 year)
mc ilm rule add --expire-days 365 local/sgc-documents
```

---

## Testing

### Backend

```bash
cd backend

# Unit tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:cov

# E2E tests (uses test database)
npm run test:e2e

# Single file
npm run test -- nominations.service.spec.ts

# Match a test name
npm run test -- --testNamePattern="creates a nomination"
```

### Frontend

```bash
cd frontend

# Vitest (unit + component tests)
npm run test

# Watch mode
npm run test:watch

# Playwright E2E
npm run test:e2e

# Playwright UI mode (debug)
npm run test:e2e -- --ui

# Single E2E spec
npm run test:e2e -- nomination-flow.spec.ts
```

### E2E with Neon preview branches

For PR-based E2E testing, the CI pipeline:

1. Creates a Neon branch from `main`
2. Applies pending migrations
3. Seeds test data
4. Points the test backend at this branch
5. Runs the E2E suite
6. Tears down the branch

See `.github/workflows/e2e.yml` (or equivalent) for the implementation.

---

## Linting & Formatting

```bash
# Backend
cd backend
npm run lint              # ESLint check
npm run lint:fix          # Auto-fix
npm run format            # Prettier

# Frontend
cd frontend
npm run lint
npm run lint:fix
npm run format
```

### Pre-commit hook (Husky)

The repo should have Husky installed to run lint + format + typecheck on staged files:

```bash
# Install husky + lint-staged on initial setup
npx husky install
```

---

## Debugging

### Backend (NestJS)

VSCode `launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug NestJS",
  "runtimeExecutable": "npm",
  "runtimeArgs": ["run", "start:debug"],
  "cwd": "${workspaceFolder}/backend",
  "console": "integratedTerminal"
}
```

Or via Chrome DevTools: `npm run start:debug` → open `chrome://inspect`.

### Frontend (Vite)

React DevTools browser extension is essential. TanStack Query and TanStack Router both have devtools components — add them to `__root.tsx`:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';

// In root component (only in dev)
{import.meta.env.DEV && (
  <>
    <ReactQueryDevtools />
    <TanStackRouterDevtools />
  </>
)}
```

---

## Database Tools

### Connect with psql

```bash
# Direct connection to Neon (use DIRECT_URL, not pooled)
psql "$DIRECT_URL"

# Inside psql:
\dt                       # List tables
\d nominations            # Describe table
\d+ nominations           # Describe with extra info (sizes, etc.)
\df                       # List functions
\du                       # List users/roles
\timing on                # Show query times
\q                        # Quit
```

### Useful diagnostic queries

```sql
-- Table sizes
SELECT
  schemaname,
  relname,
  pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC
LIMIT 20;

-- Slow queries (requires pg_stat_statements extension)
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- Active connections
SELECT pid, usename, application_name, state, query
FROM pg_stat_activity
WHERE state != 'idle';

-- Locks
SELECT * FROM pg_locks WHERE NOT granted;
```

---

## Common Gotchas

### Prisma client out of sync

```
Error: Module '@prisma/client' has been initialized with a different schema
```

**Fix**: `npx prisma generate` after pulling new migrations.

### Neon pooled connection rejecting prepared statements

Prisma uses prepared statements by default. With Neon's pooler (PgBouncer transaction mode), this can fail. Add `?pgbouncer=true` to `DATABASE_URL`:

```
DATABASE_URL=postgresql://user:pass@ep-xxxx-pooler.../portlog?sslmode=require&pgbouncer=true
```

The `directUrl` does **not** need this flag.

### Neon cold start on first request after idle

Expected behavior. First query after idle takes 300–800ms. Increase auto-suspend on Neon to mitigate (Settings → Compute → Auto-suspend delay).

### TanStack Router type generation not updating

```bash
# Force regeneration
npx tsr generate

# Or restart the dev server (the Vite plugin regenerates on save)
```

### Mantine date pickers and form values

Mantine date pickers return `Date` objects, not strings. The Zod schema must reflect this:

```typescript
// Wrong
arrival_time: z.string()

// Right (for forms)
arrival_time: z.date()

// Or, transform on submit
arrival_time: z.date().transform(d => d.toISOString())
```

---

## Useful Aliases

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# Portlog shortcuts
alias plb='cd ~/code/portlog/backend'
alias plf='cd ~/code/portlog/frontend'
alias plup='cd ~/code/portlog && docker compose up -d'
alias pldown='cd ~/code/portlog && docker compose down'
alias pllogs='cd ~/code/portlog && docker compose logs -f'
alias plprisma='cd ~/code/portlog/backend && npx prisma'
alias plstudio='cd ~/code/portlog/backend && npx prisma studio'
```

---

## Generating Random Secrets

```bash
# JWT secret (256-bit)
openssl rand -base64 32

# UUID
uuidgen

# Strong password
openssl rand -base64 24 | tr -d '/+='
```

---

## Health Check

Local quick test:

```bash
# Backend health
curl http://localhost:3000/api/health

# Frontend
curl -I http://localhost:5173

# MinIO
curl http://localhost:9000/minio/health/live

# Database (via backend)
curl http://localhost:3000/api/health/db
```

A health endpoint should be implemented in `backend/src/health/health.controller.ts` checking DB connectivity, MinIO reachability, and basic app status.
