# services (master data)

Sale service catalog (Servicios): the list of billable services a Sale on a nomination can reference. Deliberately price-less — the price is always typed per sale. Distinct from the future M6 "Service Requests" operational module (SCOPE.md #08).

## Scope

- **Roles:** OPS (read/create/edit), ADM (full incl. delete)
- **Key entities:** `services` (referenced by `sales.serviceId`, ON DELETE RESTRICT)
- **External deps:** none
- **Spec:** [docs/SCOPE.md#02-master-data](../../../../docs/SCOPE.md) · plan: `.claude/plans/02-sales-feature.md`

## API

`/master-data/services` — standard master-data CRUD (list w/ cursor pagination + `q` search, `GET /search`, `GET/:id`, `POST`, `PATCH/:id`, `DELETE/:id` ADM-only). DELETE returns 409 when the service is referenced by sales.

## Setup (from a fresh clone)

Nothing module-specific beyond the shared backend setup. Migration `20260715180517_add_services_and_sales` creates the table; `npx prisma db seed` loads a 9-entry starter catalog.

Verify: `curl -H "Authorization: Bearer <token>" localhost:3000/api/master-data/services` → `{ items: [...9 seeded services], nextCursor, hasMore }`

## Major changes — repro log

### 2026-07-15 — Module created (Sales feature)

Context: Sales on nominations need a service catalog to reference (`.claude/plans/02-sales-feature.md`).

Repro:

1. `cd backend && npx prisma migrate dev` (applies `20260715180517_add_services_and_sales`)
2. `npx prisma db seed`
3. `npm run dev` from repo root

Verify: Master Data → Services tab lists the seeded catalog; creating a duplicate name succeeds (no unique constraint, template parity with crew); deleting a service referenced by a sale returns 409.
