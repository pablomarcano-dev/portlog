# nominations

Nomination lifecycle with SN/OT correlative numbering, email compose/dispatch, and nomination-scoped sub-resources. Status is **derived** (see `packages/schemas` `deriveNominationStatus`), not a manual state machine:

- `NOMINATED` — the default, on create
- `IN_PORT` — the prearrival message was sent **and** now is past `layDaysFirst`
- `FULL_AWAY` — the final SOF was sent **and** now is past `layDaysLast`
- `CANCELLED` — a persisted manual override (requires a reason) that wins over the above

Only `NOMINATED`/`CANCELLED` are ever stored in the `status` column; `IN_PORT`/`FULL_AWAY` are computed at read time from the sent PREARRIVAL/SOF dispatches + laydays. The only manual `/transition` is to `CANCELLED`.

## Scope

- **Roles:** OPS, ADM (no hard delete — cancel via transition)
- **Key entities:** `nominations`, `nomination_status_history` (append-only), `nomination_clients` (free-text client roster), `sales` (FKs to master-data `clients`/`services`), `sof_timesheets`/`sof_entries`
- **External deps:** EmailService (SMTP), PEDR module (auto-created when the nomination is created), master-data (ports, branches, ship-particulars, clients, services)
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

- Sales are **editable on FULL_AWAY/CANCELLED nominations** — billing typically happens after operations complete.
- Sales are **not** part of the nomination `DETAIL_INCLUDE`; the Sales modal fetches them on open.
- `price` is a plain amount — currency deliberately out of scope (see `.claude/docs/open-questions.md`).

## Major changes — repro log

### 2026-07-20 — Simplify status to a derived lifecycle

Context: replace the 5-state manual state machine (DRAFT/CONFIRMED/IN_PROGRESS/COMPLETED/CANCELLED + advance buttons) with a derived 3-state lifecycle (NOMINATED → IN_PORT → FULL_AWAY) plus CANCELLED as a manual override. Status is computed from message sends + laydays; PEDR is now auto-created on nomination create (there is no manual Start step); the only manual `/transition` is cancellation.

Repro:

1. `npm run build -w @portlog/schemas` (new `deriveNominationStatus`/`NominationStatusFacts` exports; `NominationStatus` enum is now `NOMINATED`/`IN_PORT`/`FULL_AWAY`/`CANCELLED`)
2. `cd backend && npx prisma migrate deploy` (applies `20260720231141_simplify_nomination_status`: recreates the enum, remaps existing rows to NOMINATED/CANCELLED, drops+re-adds the `nomination_status_history_cancel_reason_chk` CHECK constraint around the type swap)
3. `npm run dev`

Verify:

- `npm run test -w @portlog/backend -- nominations.service` and `npm run test -w @portlog/schemas` pass.
- `POST /api/nominations` → response `status: 'NOMINATED'`, and `GET /pedr/by-nomination/:id` → 200 (PEDR auto-created).
- `POST /api/nominations/:id/transition {toStatus:'IN_PORT'}` → 400 (derived, not manual); `{toStatus:'CANCELLED'}` without a reason → 400; with a reason → 201 `status: 'CANCELLED'`.
- After sending a PREARRIVAL email with `layDaysFirst` in the past, `GET /api/nominations/:id` → `status: 'IN_PORT'`; after a SOF email with `layDaysLast` in the past → `FULL_AWAY`.

Rollback: revert the feature commit and write a down-migration that restores the 5-value enum (existing NOMINATED rows cannot be disambiguated back to DRAFT/CONFIRMED/IN_PROGRESS/COMPLETED — they would all map to NOMINATED).

### 2026-07-15 — Sales sub-resource (Sales feature)

Context: record billable services per nomination — plan `.claude/plans/02-sales-feature.md`.

Repro:

1. `cd backend && npx prisma migrate dev` (applies `20260715180517_add_services_and_sales`; note: this migration also repairs the missing `crew` table history — a drifted local dev DB needs `npx prisma migrate reset --force` + `npx prisma db seed` first)
2. `npm run build -w @portlog/schemas` (new `SaleCreateSchema`/`SaleReadSchema` exports)
3. `npm run dev`

Verify: `npm run test -w @portlog/backend -- nominations.service` passes; `GET /api/nominations/:id/sales` returns `[]` for a fresh nomination; POST with a non-existent `serviceId` (valid cuid shape) returns 400.

Rollback: revert the feature commit; migration `20260715180517_add_services_and_sales` would need a manual down-migration (drops `sales`, `services`, `crew`).
