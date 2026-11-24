# Vessel voyage number

Nomination details now stores the explicitly supplied vessel voyage in `vesselVoyageNumber`, independently of the legacy `voyageNumber`, commercial reference and agency SN/OT. The VOY input is optional. Blank input clears it; generated template VOY values use `TBC` when unknown.

Legacy `voyageNumber` values can be internal auto-assigned sequence numbers. Migration `20261124130000_vessel_voyage_number` adds a nullable column only and deliberately performs no inferred backfill or reference renumbering. Existing clients can omit the new field without clearing saved values. The shared `formatVesselVoyageNumber` function supplies the VOY fallback for subject-formatting consumers; this change does not rewrite saved or sent subjects.

Apply the additive migration through the normal reviewed deployment procedure before running the new backend. Generate Prisma client during build. No production migration is applied by this feature commit.
