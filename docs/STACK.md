# Portlog — Technical Stack Guidelines

> **Master reference document for Portlog development.**
> Stack selected after evaluating Hasura, ABP Framework, and other alternatives.
> Last updated: May 2026

---

## ⚠️ Read This First — The Golden Rules

**These rules are non-negotiable.** Portlog generates legally binding port documents (PEDR, SOF, NOR, SH-xx). A wrong timestamp on a Statement of Facts can trigger demurrage disputes worth hundreds of thousands of dollars. An incorrect Notice of Readiness can void laytime claims. Bad cargo data on official port submissions has regulatory consequences. **The rules below exist to protect data integrity, legal accuracy, and operational safety. Treat them as load-bearing.**

### 1. TypeScript Strict Mode — Always

Set `"strict": true` in `tsconfig.json` for both backend and frontend. No `any` types in production code without an explicit `// @ts-expect-error: <reason>` comment. The type system is what catches the wrong kind of `Date` being passed to a SOF event before it reaches the database.

**Why it matters:** A loosely-typed `event_time` field that accepts both strings and Dates will eventually accept the wrong format, and you will not find out until an agent submits the SOF to the harbor master.

### 2. Zod is the Single Source of Truth for Validation

Every form, every API endpoint, every external integration response — validated with a Zod schema. Schemas live in `frontend/src/schemas/` and are consumed by both frontend (via `zodResolver`) and backend (via `nestjs-zod`).

**Why it matters:** Two parallel validation rules (one in frontend, one in backend) will diverge. When they diverge, invalid data will pass one and fail the other, and you will spend a day debugging why a nomination "saved successfully" but doesn't show up in the list.

### 3. All Server State Through TanStack Query

Never use `useEffect` for data fetching. Never use `useState` to hold server data. Every read uses `useQuery`. Every write uses `useMutation` with explicit `invalidateQueries` for affected data.

**Why it matters:** Manual cache management on a CRUD-heavy app with 40 tables and inter-table relationships will produce stale UI bugs that look like data corruption. An OPS agent who sees an outdated list of nominations may assume a vessel hasn't been entered and create a duplicate.

### 4. All Forms Through react-hook-form + zodResolver

Never `useState` per field. Never roll your own form library. Never bypass the Zod schema "just for this small form."

**Why it matters:** Hand-rolled forms drift in validation behavior. Field-level state in 22 forms means 22 different ways to handle dirty/touched/error/submitting states. Inconsistency in the UI for an internal tool makes operators slower and more error-prone.

### 5. Authorization Lives in the Backend

The frontend may show or hide UI based on roles. The backend **must** verify every operation. A user with browser dev tools can flip any frontend role check.

**Why it matters:** Roles in Portlog are not cosmetic. ADM can delete master data; OPS cannot. If only the frontend enforces this, an OPS user can craft a request and corrupt the providers list. There is no audit trail that catches "user used the wrong role."

### 6. Migrations Are Versioned in Git — Always

Use `prisma migrate dev` locally, commit the generated SQL, and apply with `prisma migrate deploy` in production. **Never** run `prisma db push` against any branch other than ephemeral development. **Never** edit a previously-applied migration.

**Why it matters:** A schema that is not in git history is a schema that cannot be rolled back, audited, or reproduced on a fresh environment. The first time production schema differs from staging is the first time a deploy will silently corrupt data.

### 7. Documents and Files Live in MinIO, Never in the Database

Generated PDFs, uploaded scans, manifests, certificates — all go to MinIO under the SGC folder structure. The database stores the path/key, not the bytes.

**Why it matters:** Putting binaries in Postgres bloats backups, slows queries, and turns a 500MB database into a 50GB backup nightmare. It also makes branching in Neon expensive.

### 8. Structured Logging from Day One

Use `pino` or `nestjs-pino`. Every log entry has a correlation ID, user ID, and structured fields. No `console.log` in committed code.

**Why it matters:** When an agent reports "the SOF didn't send last Tuesday afternoon," you need to find that exact request in production logs. Unstructured logs make this impossible at scale.

### 9. End-to-End Tests for Critical Flows

At minimum: nomination creation → PEDR sub-document submission → SH-xx generation → All Sent. These run on every PR. They use a Neon preview branch with seeded data.

**Why it matters:** Manual testing of a 30-screen workflow is infeasible. The flows that produce legal documents are exactly the flows that must not regress silently.

### 10. Never Trust External Data Without Validation

AIS responses, WhatsApp webhooks, email replies, AIS API quirks — all parsed through Zod schemas before entering the application. Log and reject malformed payloads explicitly.

**Why it matters:** AIS providers occasionally return strings where numbers are expected, or vice versa. An IMO that arrives as `"7654321"` vs `7654321` and is silently coerced wrong will land in the database and propagate to documents.

---

## Executive Summary

Portlog is an internal port agency operations application (~30 screens, ~22 forms, ~40 tables, 2 roles: OPS and ADM). The stack prioritizes:

- **Single language (TypeScript)** end-to-end
- **First-class custom logic** (PDFs, WhatsApp, AIS, SH-xx document generation)
- **Zero licensing cost** — entire stack is MIT / Apache 2.0
- **Simple deployment** — Docker containers, no complex orchestration
- **Excellent DX** for a small team maintaining the app long-term

---

## Complete Stack

| Layer | Technology | License |
|---|---|---|
| Backend framework | NestJS | MIT |
| ORM | Prisma | Apache 2.0 |
| Database | PostgreSQL (Neon serverless) | PostgreSQL / Apache 2.0 |
| Authentication | Passport-JWT + NestJS Guards | MIT |
| Validation | Zod (shared frontend/backend) | MIT |
| Document storage | MinIO (S3-compatible) | AGPL v3 (internal use OK) |
| PDF generation | Puppeteer | Apache 2.0 |
| Frontend bundler | Vite | MIT |
| UI framework | React 19 | MIT |
| Routing | TanStack Router | MIT |
| Server state | TanStack Query | MIT |
| Forms | react-hook-form | MIT |
| Components | Mantine (recommended) or shadcn/ui | MIT |
| Styling | Tailwind CSS | MIT |
| Containerization | Docker + docker-compose | Apache 2.0 |
| Reverse proxy | Nginx (static frontend) | BSD-style |
| Logging | Pino + nestjs-pino | MIT |

**Total licensing cost: $0.** The client owns 100% of the code.

---

## Backend — NestJS

### Why NestJS

- Opinionated modular architecture (Modules, Controllers, Services, Providers)
- Native DI container, similar to Spring/Angular
- Decorators for routes, validation, guards, interceptors
- Mature ecosystem: `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/schedule`, `@nestjs/bull`
- All custom Portlog logic (PDFs, WhatsApp, AIS, dispatchers) lives in the same process

### Suggested Structure

```
backend/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── auth/                  # JWT, guards, @Roles decorator
│   ├── users/
│   ├── prisma/                # Injectable PrismaService
│   ├── nominations/           # Central module
│   ├── ship-particulars/
│   ├── master-data/           # Providers, Charterers, Owners, etc.
│   │   ├── providers/
│   │   ├── charterers/
│   │   ├── operators/
│   │   ├── owners/
│   │   ├── shippers/
│   │   ├── agents/
│   │   ├── ports/
│   │   ├── flags/
│   │   ├── cargoes/
│   │   ├── activities/
│   │   └── contacts/
│   ├── pedr/                  # PEDR + sub-documents
│   ├── documents/             # SH-xx, PDF generation
│   ├── services/              # Service requests (boat, taxi, etc.)
│   ├── financial/             # PDA, FDA
│   ├── integrations/
│   │   ├── ais/               # AIS lookup
│   │   ├── whatsapp/          # WhatsApp dispatcher
│   │   ├── email/             # Nodemailer
│   │   └── storage/           # MinIO client
│   └── common/                # Filters, pipes, interceptors
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/
├── Dockerfile
└── package.json
```

### Rapid CRUD Generation

`nest g resource <name>` generates Module + Controller + Service + DTOs + Entity in ~15 minutes per entity. For 40 tables: ~10 hours of well-done scaffolding.

---

## Database — Neon + Prisma

### Why Neon

- **Copy-on-write branching** for environments (dev/staging/per-PR previews)
- **Built-in PITR** — 7 days on Launch, 30 days on Scale
- **Scale-to-zero** — Portlog is used during business hours; idle the rest
- **Pure Postgres** — no proprietary extensions, exportable via `pg_dump`
- **Apache 2.0** — engine is open source, low vendor lock-in

### Prisma Configuration

`schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")        // pooled (pgbouncer)
  directUrl = env("DIRECT_URL")           // unpooled, for migrations
}

generator client {
  provider = "prisma-client-js"
}
```

### Branching Strategy

| Neon Branch | Purpose |
|---|---|
| `main` | Production |
| `staging` | Next release, synthetic data |
| `dev` | Active development |
| `pr-<n>` | Per-PR preview (ephemeral, auto-delete) |

### Recommended Configuration

- **Auto-suspend**: 10–15 minutes (default is 5)
- **Restore window**: 7 days
- **Region**: `aws-us-east-2` (no South America region available)
- **Plan**: Launch (~$5–40/month depending on usage)

---

## Authentication

### Strategy

- **Passport-JWT** for token issuance and validation
- **NestJS Guards** for endpoint protection
- **RBAC via decorators** for two roles: `OPS` and `ADM`
- **bcrypt** for password hashing
- Refresh tokens in httpOnly cookies

### Custom Decorators

```typescript
@Controller('nominations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NominationsController {
  @Post()
  @Roles('OPS', 'ADM')
  create(@Body() dto: CreateNominationDto) { ... }

  @Delete(':id')
  @Roles('ADM')                     // ADM only
  remove(@Param('id') id: string) { ... }
}
```

### Why Not Keycloak

For Portlog (~10 concurrent users, 2 roles, internal app) Keycloak is unnecessary infrastructure. Native JWT in NestJS is sufficient and removes one container from the stack.

---

## Estimated Monthly Costs

| Component | Cost |
|---|---|
| Neon Launch (production DB + branches) | $15–40 |
| VPS for containers (4GB RAM) | $20–30 |
| Domain + SSL (Certbot) | $1–2 |
| MinIO (on the same VPS) | $0 |
| Offsite backups (optional, S3/B2) | $1–5 |
| **Total** | **~$40–80/month** |

---

## Milestone Mapping

| # | Milestone | Stack pieces involved |
|---|---|---|
| M1 | Infra & Auth (45–55 hrs) | Docker, NestJS auth module, Prisma init, JWT, frontend skeleton |
| M2 | Forms + Master Data + AIS Research (110–130 hrs) | 11 master data backend + frontend modules, complete Prisma schema |
| M3 | Nomination + AIS Integration (70–85 hrs) | Nominations module, AIS integration, Ship Particulars |
| M4 | PEDR & Port Documents (80–90 hrs) | PEDR state machine, sub-documents, PDF generation via Puppeteer |
| M5 | SH-xx Documents & All Sent (50–60 hrs) | SH-66A/09A/28A/29A templates, dispatch |
| M6 | Services, Integrations & Deployment (70–80 hrs) | Service requests, WhatsApp, email, MinIO, production deploy |
| M7 | Documentation & Training (35–45 hrs) | Docs, training material |
| **Total** | | **460–545 hrs** |

---

## Explicitly Discarded Alternatives

| Alternative | Why discarded |
|---|---|
| Hasura + Actions handler | Heavy custom logic (PDFs, AIS, WhatsApp) → better in-process |
| ABP Framework (.NET) | Team is TypeScript; ABP is .NET-only |
| Keycloak | Overkill for 2 roles and ~10 users |
| Next.js | No SEO or SSR justification, unnecessary complexity |
| TypeORM | Prisma is objectively better in 2026 for greenfield |
| Self-hosted Postgres | Neon saves ops + free branching for environments |
| Firebase / Supabase | Larger vendor lock-in, worse cost scaling |

---

## Companion Documents

- **[FRONTEND.md](./FRONTEND.md)** — Frontend stack, structure, patterns
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — Docker, deployment, environment, production checklist
- **[DEVELOPMENT.md](./DEVELOPMENT.md)** — Daily commands, workflows, debugging

---

## References

- NestJS: https://docs.nestjs.com
- Prisma: https://www.prisma.io/docs
- Neon: https://neon.com/docs
- TanStack Router: https://tanstack.com/router
- TanStack Query: https://tanstack.com/query
- react-hook-form: https://react-hook-form.com
- Mantine: https://mantine.dev
- Zod: https://zod.dev
