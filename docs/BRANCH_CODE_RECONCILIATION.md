# Branch code reconciliation

The November 23 procedure screenshot specifies eight business mappings:

| Code | Branch         |
| ---- | -------------- |
| MBO  | Maracaibo      |
| PFJ  | Punto Fijo     |
| PBO  | Puerto Cabello |
| LGR  | La Guaira      |
| CRN  | Carenero       |
| JSE  | José           |
| PLC  | Puerto La Cruz |
| GRA  | Güiria         |

Run the read-only report against a complete, unfiltered local branch export:

```sh
npm run build -w @portlog/schemas
npm run --silent branches:reconcile -- /path/to/branches.json
```

The input may be an array of `{id, name, code}` rows or the existing list response envelope with `items`, `hasMore: false`, and `nextCursor: null`. Combine all cursor pages before review. Incomplete cursor responses are rejected; a bare array is treated as a complete supplied export. Only ID, name and code are included in reports, so unrelated contact details in a full export are discarded.

Exit status is 0 when all eight names and codes match, 2 when any mapping requires review, and 1 for invalid input. JSON output reports matched, missing, code-mismatch or conflict status, with candidate records and reasons. Name matching ignores accents, case and repeated whitespace, but requires the complete branch identity. `José Ignacio` is not `José`, even if a demo record uses `JSE`. Duplicate names, codes and IDs are conflicts. Extra branches remain listed as unmapped; they are never deleted.

`reconcileNavieramarBranchCodes` and the canonical map live in `@portlog/schemas`, and the CLI consumes that same validated function. The CLI has no database connection, write mode, generated SQL, seed or automatic rename. It does not decide SN/OT format, counter scope or legacy-number allocation.

## Application still required

No authoritative production branch export was supplied to this implementation. Before applying codes, an administrator must review the report against the real branches and resolve conflicting identities, missing branches and historical references. Any approved data change needs a separate reviewed migration or administrative update that preserves IDs and nomination relationships. This commit does not claim production branch mappings were changed, nor that old records were renumbered.
