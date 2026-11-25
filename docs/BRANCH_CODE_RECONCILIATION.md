# Branch code reconciliation

José Bello's revised answers (`RESPUESTAS SYSPORTLOG - REV.docx`, November 24, 2026, 5:50 PM, pages 4–5) supply seven current entries. The read-only report compares the supplied export against this guidance:

| Code | Branch                |
| ---- | --------------------- |
| MBO  | Maracaibo             |
| PFJ  | Punto Fijo            |
| PBO  | Puerto Cabello        |
| LGR  | La Guaira             |
| CRN  | Carenero              |
| PLC  | Puerto La Cruz y Jose |
| GRA  | Güiria                |

The earlier November 23 procedure screenshot (section 7.3.1) has eight mappings: the six unchanged entries above plus separate `PLC = Puerto La Cruz` and `JSE = José`. Both source lists remain in the implementation: `NAVIERAMAR_BRANCH_CODES` is the current seven-entry guidance; `NAVIERAMAR_LEGACY_PROCEDURE_BRANCH_CODES` retains the eight-entry evidence. The report includes the earlier list and explains the discrepancy. These sources do not establish how existing JSE records should be treated.

Run the read-only report against a complete, unfiltered local branch export:

```sh
npm run build -w @portlog/schemas
npm run --silent branches:reconcile -- /path/to/branches.json
```

The input may be an array of `{id, name, code}` rows or the existing list response envelope with `items`, `hasMore: false`, and `nextCursor: null`. Combine all cursor pages before review. Incomplete cursor responses are rejected; a bare array is treated as a complete supplied export. Only ID, name and code are included in reports, so unrelated contact details in a full export are discarded.

Exit status is 0 when all seven names and codes match and no legacy conflict remains, 2 when any mapping or legacy identity requires review, and 1 for invalid input. JSON output reports matched, missing, code-mismatch or conflict status, with candidate records and reasons. Name matching ignores accents, case and repeated whitespace, but requires the complete branch identity. A separate `Puerto La Cruz` row does not match `Puerto La Cruz y Jose`. `José Ignacio` is not `José`, even if a demo record uses `JSE`. Duplicate names, codes and IDs are conflicts. Extra branches remain listed as unmapped; they are never deleted.

Every row using `JSE`, or named exactly `José` or `Puerto La Cruz` after normalization, appears in `legacyConflicts` and forces review even if all seven current entries already match. This deliberately includes unrelated demo branches that occupy JSE: code alone is not proof of branch identity. Carlos Ferrer's authoritative export and an explicit decision about historical references are needed before any consolidation. The report never proposes merging IDs, renaming rows, reassigning nominations or converting old references to PLC.

`reconcileNavieramarBranchCodes` and the canonical map live in `@portlog/schemas`, and the CLI consumes that same validated function. The CLI has no database connection, write mode, generated SQL, seed or automatic rename. It does not decide SN/OT format, counter scope or legacy-number allocation.

## Application still required

No authoritative production branch export was supplied to this implementation. Before applying codes, an administrator must obtain the export from Carlos Ferrer, review the report against the real branches and resolve the seven-versus-eight source discrepancy, conflicting identities, missing branches and historical references. Any approved data change needs a separate reviewed migration or administrative update that preserves IDs and nomination relationships. This commit does not claim production branch mappings were changed, nor that old records were renumbered.
