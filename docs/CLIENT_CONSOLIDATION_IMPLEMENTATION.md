# Client consolidation: implementation and reset runbook

Implemented on `codex/unify-clients`, based on the [research plan](CLIENT_CONSOLIDATION_PLAN.md). Existing service-request work in the checkout is retained.

## Delivered behavior

- The existing Client model and `/master-data/clients` API replace Clients, Charterers, Shippers and Operators. `entityType` classifies the company; it never restricts a nomination role.
- Clients and Contacts use typed phone and address collections, normalized email arrays and internal notes. `ClientContact` is the single company/person relationship and supports shared contacts. Owners remain separate.
- Client standing instructions, structured tariff entries and four message-group assignments use one shared form, including the nomination's Add Client modal.
- The nomination instruction client, charterer, roster clients and vessel operator all reference Client. Role changes retain references. Manual roster names remain supported; directory suggestions select explicit IDs even when names repeat.
- All four client email groups are available alongside global email groups in nomination recipient pickers, compose drawers and SH document sending. Applying groups fetches current members and deduplicates recipients. The instruction Client's four groups and standing instructions populate the retained DOCX; internal notes are excluded.
- Old company screens redirect to Clients. Old company APIs and schemas are removed. Legacy request fields are rejected, preventing silently discarded edits.
- Collection PATCH semantics: omitted means unchanged; `[]` clears; supplied entries replace atomically. Nullable text and links accept `null` for clearing. Failed related-record updates roll back the entire write.

## Live catalog preservation

**Captured 361 Activities and 11 Cargoes from the repository-configured database `localhost:5432/portlog` on 10 September 2026 at 14:28 UTC. No live database has been reset.** The repository seed fixtures contain this capture, verified against their manifest. The source became available during implementation after the initial connection failure. Confirmation that this is the intended reset target remains pending. The reset command rechecks the capture against current source data, so any edits after capture require a fresh export with writers stopped.

The seed requires `backend/prisma/catalog-fixtures/activities.json`, `cargoes.json` and `manifest.json`; it fails before making writes when these are absent or fail validation. The old sample catalog arrays have been removed. Capture includes all current table fields, stable IDs, comments, units, SN/OT categories and PostgreSQL timestamp precision. Duplicate names remain separate records.

## Reset procedure

1. Identify the authoritative database and configure `backend/.env`. Ensure `DATABASE_URL` and `DIRECT_URL` identify the same target. Stop the app and all other database writers for the entire capture/reset/verification window.
2. From the repository root, run `npm run catalogs:export -w @portlog/backend`. This reads both catalogs in one repeatable-read transaction. Inspect the resulting counts and commit all three fixture files with this change. Keep a separate copy through the reset.
3. Run `npm run catalogs:verify -w @portlog/backend`. It validates field shapes, IDs, row counts and checksums. The manifest includes sanitized source identity and migration names, never credentials.
4. Run `npm run db:reset:catalogs -w @portlog/backend`. It checks the actual source against the capture and rejects different targets or changed records before resetting. It generates Prisma Client, resets/replays migrations, runs the seed and compares the restored catalogs field-for-field.
5. Build and restart the application after successful verification. Reopen Activities and Cargoes, then create/edit a client, link it in a nomination, apply message groups and generate instructions.

The new migration refuses populated legacy company/contact directories before issuing any schema changes. This is deliberately a reset/reseed release, not an in-place backfill. Do not bypass this by deploying migrations against the populated old database.

If seeding or verification fails after reset, preserve the captured fixtures. Fix the failure and resume seeding/verification using that capture; never recapture an empty or partially seeded database. Subsequent ordinary seed runs insert missing catalog IDs without overwriting edits to existing records. Exact whole-catalog equality is required immediately after the reset, not after later user edits.

## Verification completed

- Production build of shared schemas, backend and frontend.
- Shared schemas: 220 tests; backend: 346 tests; frontend: 83 tests; catalog capture/reset checks: 4 tests.
- Full migration history and rewritten seed on isolated PostgreSQL databases; guarded reset restored exact synthetic catalog records. Duplicate cargo names and microsecond timestamps were included. A separate fresh database was seeded with the actual 361 Activities and 11 Cargoes and verified against the capture. Rerunning the seed retained one company per seeded entity and exactly four email assignments.
- Real HTTP integration: create/update all four types, select each in a nomination role, retain ID on role change, share one contact across four clients, reject legacy fields/duplicate addresses, roll back invalid links, clear collections, collect contextual groups and generate DOCX using a SHIPPER instruction client.
- Browser verification: unified directory loads, client instructions save/reopen, New clears the form, four groups load, legacy company routes redirect, directory selection retains IDs through role changes, and all four groups can be added to recipients with deduplication.
- DOCX visual review: ordinary two-page output and a three-page case with 45 instruction lines and 12 recipients in each of four groups. All pages reviewed; content remains readable and page numbering updates.

The test database and generated QA artifacts are separate from application data. Email delivery was not exercised; the recipient-selection paths were tested without sending messages.
