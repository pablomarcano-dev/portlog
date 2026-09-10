# Live catalog seed fixtures

Current capture: 361 Activities and 11 Cargoes from configured
`localhost:5432/portlog`, 2026-09-10 14:28 UTC. No source database reset has
been performed. Re-export with writers stopped immediately before reset if
any source rows have changed.

Before resetting the designated application database, stop its writers and run
`npm run catalogs:export -w @portlog/backend`. This captures all Activities and
Cargoes fields, including IDs and PostgreSQL timestamp precision. Commit the
resulting `activities.json`, `cargoes.json`, and `manifest.json` with the refactor.

`npm run db:reset:catalogs -w @portlog/backend` checks the snapshot against the
source before resetting, seeds the new schema, and verifies exact restoration.
It refuses a missing, modified, or stale capture. There is no sample fallback.

Do not regenerate these files from an empty or partially reseeded database.
Use separate synthetic fixtures only in isolated automated tests.
