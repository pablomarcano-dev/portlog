# Operational update modes

The nomination Actions panel has an **Operational Update** action. Select one of:

- At anchor: `Update at Anchor DD.MM.YYYY HH:mm Hrs`.
- Alongside without operations: `Update at Alongside DD.MM.YYYY HH:mm Hrs`.
- Alongside in operations: `Cargo Update DD.MM.YYYY HH:mm Hrs`, continuing into the existing parcel/cargo-update workflow.

A recognized latest saved SOF activity may suggest a mode. An empty log, an unknown latest event or conflicting events at the same latest time leaves the choice empty. The generic nomination status (such as `IN_PORT`) is never used to assume berth or cargo state. Operators may override a suggested mode. Selecting a mode does not update SOF events or lifecycle status.

Date/time fields use the agency calendar in `America/Caracas`. Only automatic subject display rounds to ten minutes. Editing either field preserves the exact entered value; a Cargo choice carries those values into its existing dialog. The email compose editor continues to preserve authored subject changes.

Anchor and Alongside are plain-text nomination-level messages recorded under the new `OPERATIONAL_UPDATE` dispatch type. They are not final/interim SOF messages, generate no SOF document, and do not advance a vessel lifecycle. Cargo remains `CARGO_UPDATE`. Historical messages and operational timestamps are unchanged.

The backend compose route validates optional `mode`, `at` (ISO instant) and `automatic` query parameters. `OPERATIONAL_UPDATE` requires an explicit Anchor/Alongside mode. Its defaults are built with the shared formatter, preserving the nomination's current business-reference text without choosing a new SN numbering scheme. The additive `20261124150000_operational_update_email` enum migration must be applied before this feature is rolled out. No production migration is performed by implementation or tests.
