# nominations

Nomination lifecycle (DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED / CANCELLED) with append-only status history, SN/OT correlative numbering, email compose/dispatch, and nomination-scoped sub-resources.

## Scope

- **Roles:** OPS, ADM (no hard delete — cancel via transition)
- **Key entities:** `nominations`, `nomination_status_history` (append-only), `nomination_clients` (free-text client roster), `sales` (FKs to master-data `clients`/`services`), `sof_timesheets`/`sof_entries`
- **External deps:** EmailService (SMTP), PEDR module (auto-created on Start), master-data (ports, branches, ship-particulars, clients, services)
- **Spec:** [docs/SCOPE.md#03-nominations](../../../docs/SCOPE.md)

## Sub-resources (`/nominations/:id/...`)

| Path                                                                          | Verbs                 | Notes                                                                                                                                               |
| ----------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/clients`                                                                    | GET/POST/PATCH/DELETE | free-text roster rows (Type/Name/Voy/Ref/Broker), sortOrder                                                                                         |
| `/sales`                                                                      | GET/POST/PATCH/DELETE | Sale rows: `clientId`+`serviceId` (master-data FKs), `price` Decimal(12,2), `date`, `notes`. Bad FK → 400; row scoped to nomination → 404 otherwise |
| `/eta`                                                                        | GET/PUT               | ETA record                                                                                                                                          |
| `/sof`                                                                        | GET/PUT               | SOF timesheet                                                                                                                                       |
| `/messages`, `/compose/:actionType`, `/send-email`, `/parcels`, `/transition` | —                     | messaging + state machine                                                                                                                           |

Design decisions (Sales, 2026-07-15):

- Sales are **editable on COMPLETED/CANCELLED nominations** — billing typically happens after operations complete.
- Sales are **not** part of the nomination `DETAIL_INCLUDE`; the Sales modal fetches them on open.
- `price` is a plain amount — currency deliberately out of scope (see `.claude/docs/open-questions.md`).

## Major changes — repro log

### 2026-07-15 — Sales sub-resource (Sales feature)

Context: record billable services per nomination — plan `.claude/plans/02-sales-feature.md`.

Repro:

1. `cd backend && npx prisma migrate dev` (applies `20260715180517_add_services_and_sales`; note: this migration also repairs the missing `crew` table history — a drifted local dev DB needs `npx prisma migrate reset --force` + `npx prisma db seed` first)
2. `npm run build -w @portlog/schemas` (new `SaleCreateSchema`/`SaleReadSchema` exports)
3. `npm run dev`

Verify: `npm run test -w @portlog/backend -- nominations.service` passes; `GET /api/nominations/:id/sales` returns `[]` for a fresh nomination; POST with a non-existent `serviceId` (valid cuid shape) returns 400.

Rollback: revert the feature commit; migration `20260715180517_add_services_and_sales` would need a manual down-migration (drops `sales`, `services`, `crew`).
