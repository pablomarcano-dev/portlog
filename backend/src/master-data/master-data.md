# master-data

CRUD for the reference tables every other module points at — vessels, ports, and the contact book
of owners, operators, shippers, charterers, agents, suppliers, clients and email groups.

## Scope

- **Roles:** OPS reads and edits; ADM additionally may delete (enforced in `ButtonBar`).
- **Key entities:** `ship_particulars`, `ports`, `piers`, `flags`, `activities`, `cargoes`, `crew`,
  `owners`, `operators`, `shippers`, `charterers`, `agents`, `contacts`, `suppliers`, `clients`,
  `services`, `branches`, `email_groups`
- **External deps:** Datalastic (vessel lookup on Ship Particulars); every other module reads these
  tables as foreign keys.
- **Spec:** [docs/SCOPE.md](../../../docs/SCOPE.md)

## Setup (from a fresh clone)

1. `npm install` at the repo root.
2. Start Postgres (`docker compose up -d postgres`) and set `DATABASE_URL` in `backend/.env`.
3. `cd backend && npx prisma migrate deploy` — migrations also auto-apply on backend start.
4. `npx prisma db seed` for the reference rows.

Verify: `npm run dev` at the root, then open `/master-data/ports` → the left rail lists ports
grouped by country.

## Major changes — repro log

### 2026-07-26 — Multi-address email fields, optional-field fix, port grouping

Context: user feedback in `nuevo sysportlog.pdf` (22 Jul 2026) — optional fields blocked saving,
so no nomination could be created; single-address email validation rejected the comma-separated
lists actually in use. Plan: `.claude/plans/03-master-data-feedback-fixes.md`.

Three things a future maintainer needs to know:

1. **`optionalText(n)` replaces `z.string().min(1).max(n).optional()`** everywhere in
   `packages/schemas/src/master-data`. The old form rejected `""`, which is what React Hook Form
   submits for an untouched input, so nominally-optional fields behaved as required. Use the
   helpers in `packages/schemas/src/common/fields.ts` — never `.min(1)…optional()` — for any new
   optional field. Same trap applies to `.url()` and `.cuid()`; use `optionalUrl` / `optionalCuid`.
2. **Email columns are `text[]`, not `text`.** `shippers`, `operators`, `contacts`,
   `ship_particulars`, `clients`, `suppliers` expose `emails`; `branches` exposes `emails` and
   `contactEmails`. `branches.emails` and `branches.contactEmails` render into the `agent_email`
   and `contact_email` template variables, joined with `'; '` (`nominations.service.ts`).
3. **Contact search by email is exact-match only.** `text[]` supports `has`, not `contains`, so a
   substring email search no longer works (name search is unaffected).
4. **`@Body()` DTOs are now actually validated.** `nestjs-zod`'s `ZodValidationPipe` had never been
   registered, so `@Body() dto: CreateXDto` was decorative — bodies were unvalidated and no Zod
   `preprocess` ran, which is why `""` reached the database instead of `NULL`. It is now an
   `APP_PIPE` in `AppModule`, covering every controller. Nothing extra is needed on new controllers.
5. **`DATABASE_URL` must not be set in the monorepo-root `.env`.** That file exists for
   docker-compose variable substitution; `docker-compose.yml` derives `DATABASE_URL` itself. If the
   key is present there, Prisma finds it while searching upward from `backend/` and it shadows
   `backend/.env`, so `npm run start:dev` points at the wrong port.

Repro:

1. `cd backend && npx prisma migrate deploy` — applies
   `20260726150000_email_fields_to_arrays`, which **drops and recreates** the email columns with no
   backfill. Any single-address values in them are lost; this was accepted because the app was not
   yet in real use.
2. `npx prisma generate`
3. `npm run --workspace=@portlog/schemas build`

Verify:

- `cd packages/schemas && npx jest src/common` → 22 passing, covering the paste shapes and the
  name-only-record case that used to fail.
- In the app: create an Owner with only a name → saves. Paste
  `a@x.com, b@x.com; c@x.com` into a Shipper → three chips.

Rollback: `git revert` the commit, then hand-write the inverse migration — `prisma migrate deploy`
will not undo a dropped column on its own.

### 2026-07-26 — Repaired two long-broken test suites

Both failed on a clean checkout of `main` and were unrelated to the email work; fixed in the same
pass. Backend now runs 16 suites / 175 tests green.

- **`ports.service.spec.ts`** was written in POR-33 (`9df9ddf`) against a self-referencing
  country → port → terminal hierarchy — `parentId`, a 3-level depth cap, `getTree()`. `6cdfb37`
  replaced that with the flat Port + `Pier` child table and the spec was never updated, so six
  cases called methods that no longer exist. Rewritten against the real service (list paging and
  cursor, getById with piers, create/update conflict mapping, remove, countries, search).
  **Terminals and berths are `Pier` rows — do not reintroduce `parentId`.**
- **`sh-documents.service.spec.ts`** imported `vitest`, which is the _frontend's_ runner; the
  backend is Jest, so the whole suite failed to load and its 10 FSM assertions never ran. Converted
  to Jest globals and `jest.fn()`.

Also corrected a stale comment on `PortsService.remove()`: it claimed deletion was blocked while a
port still had piers. No such guard exists — `Pier.portId` is `onDelete: Cascade`, so piers are
removed along with the port.
