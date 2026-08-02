/**
 * Cargo quantity units, shared by the nomination parcel rows and the Cargo
 * Update modal. One list so the unit picked when the nomination is created is
 * the same token that comes back on the cargo-update notice.
 */
export const UNIT_OPTIONS = [
  { value: 'Bbls', label: 'Bbls' },
  { value: 'Kg', label: 'Kg' },
  { value: 'Us/G', label: 'Us/G' },
  { value: 'C/M', label: 'C/M' },
  { value: 'L/T', label: 'L/T' },
  { value: 'M/T', label: 'M/T' },
  { value: 'Unit', label: 'Unit' },
];

/**
 * Select data for a unit cell: the canonical list plus whatever is already on
 * the row — a product's catalog `bblUnit`, or a legacy free-typed value.
 *
 * Mantine renders an empty box for a `value` that is missing from `data`, so
 * without this the cell would look blank while a unit is in fact stored, and
 * the notice would go out with a unit the operator never saw.
 */
export function unitSelectData(...extras: Array<string | null | undefined>) {
  const options = [...UNIT_OPTIONS];
  const seen = new Set(options.map((o) => o.value));

  for (const extra of extras) {
    const value = extra?.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: value });
  }

  return options;
}
