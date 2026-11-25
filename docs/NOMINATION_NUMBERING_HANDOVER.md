# SN/OT numbering handover

José Bello's November 24 answers select `SN####/YY/SUC` and `OT####/YY/SUC`, with at least four digits, opening-year suffix, no annual reset and independent SN/OT sequences. SN is national; OT scope must be supplied explicitly. New references are immutable snapshots. Historical nominations retain a null snapshot and their original rendering/agency override; historical documents and saved/sent subjects are not rewritten.

The new allocator is inactive until a verified handover is configured. An absent configuration or future cutover preserves existing application behavior and the legacy shared internal correlative. That internal counter is not used to seed the official series. Once active, a missing/exhausted series blocks creation instead of guessing a number. Issuance and nomination creation share one database transaction, so failures roll back both. Changing the nomination date or branch later does not change its issued reference.

## Activation inputs still required

Obtain the authorized legacy export and final counters from Carlos Ferrer, confirm the old issuer is read-only, agree the precise cutover timestamp and OT scope, and reconcile the current branch list (including PLC/Jose versus historic JSE). These inputs have not been supplied. No activation has been performed.

After deploying the additive migration, prepare a reviewed manifest with:

```json
{
  "cutoverAt": "2026-12-01T12:00:00Z",
  "legacyExportAsOf": "2026-12-01T11:59:00Z",
  "legacyExportSha256": "REPLACE_WITH_ACTUAL_EXPORT_SHA256",
  "legacySystemReadOnlyConfirmed": true,
  "otScope": "GLOBAL",
  "branches": [{"id": "ACTUAL_BRANCH_ID", "code": "PLC"}],
  "lastIssued": {"SN": 3140, "OT": 125}
}
```

Every value above is illustrative. For `BRANCH` OT scope, `lastIssued.OT` must instead map every listed branch ID to its verified last-issued OT. A zero is valid only when the owner verifies that series has never issued a number. Include all authoritative active branches. A new branch under branch-scoped OT requires its own reviewed counter initialization before issuance; this tool deliberately refuses repeat activation/reseeding.

Run a local validation/report first; this mode never connects to a database:

```sh
node scripts/nomination-numbering-handover.cjs reviewed-manifest.json
```

After reviewing the target database and the actual legacy export, an operator can explicitly activate using the configured `DATABASE_URL`:

```sh
node scripts/nomination-numbering-handover.cjs reviewed-manifest.json --apply --legacy-export actual-export.json
```

Activation verifies the export hash and current branch IDs/codes, initializes separate series and records the handover timestamp/hash in one transaction. It never imports legacy rows, renames branches, sets the internal correlative or updates historical nominations. The read-only attestation and counter correctness require the data owner's review; the script cannot verify the external issuer's state. Preserve the reviewed manifest/export and operator review evidence with the deployment record.
