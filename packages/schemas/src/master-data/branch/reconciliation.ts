import { z } from 'zod';

/** Procedure section 7.3.1; business codes do not identify database rows by themselves. */
export const NAVIERAMAR_BRANCH_CODES = [
  { code: 'MBO', name: 'Maracaibo' },
  { code: 'PFJ', name: 'Punto Fijo' },
  { code: 'PBO', name: 'Puerto Cabello' },
  { code: 'LGR', name: 'La Guaira' },
  { code: 'CRN', name: 'Carenero' },
  { code: 'JSE', name: 'José' },
  { code: 'PLC', name: 'Puerto La Cruz' },
  { code: 'GRA', name: 'Güiria' },
] as const;

export const BranchReconciliationRowSchema = z.object({
  id: z.string().trim().min(1).max(100).optional(),
  name: z.string().trim().min(1).max(200),
  code: z.string().trim().max(20),
});
const rowsSchema = z.array(BranchReconciliationRowSchema).max(10_000);
export const BranchReconciliationExportSchema = z.union([
  rowsSchema,
  z
    .object({
      items: rowsSchema,
      hasMore: z.literal(false).optional(),
      nextCursor: z.null().optional(),
    })
    .transform(({ items }) => items),
]);

export type BranchReconciliationRow = z.infer<typeof BranchReconciliationRowSchema>;
export type BranchReconciliationStatus = 'matched' | 'missing' | 'code_mismatch' | 'conflict';

/** Exact normalized identity only: José is accepted; José Ignacio is a different branch. */
export function normalizeBranchIdentity(name: string): string {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function reconcileNavieramarBranchCodes(input: unknown) {
  const rows = BranchReconciliationExportSchema.parse(input);
  const normalizedCode = (row: BranchReconciliationRow) => row.code.trim().toUpperCase();
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.id) idCounts.set(row.id, (idCounts.get(row.id) ?? 0) + 1);
  }
  const repeatedIds = new Set([...idCounts].filter(([, count]) => count > 1).map(([id]) => id));
  const mappings = NAVIERAMAR_BRANCH_CODES.map((expected) => {
    const named = rows.filter(
      (row) => normalizeBranchIdentity(row.name) === normalizeBranchIdentity(expected.name),
    );
    const coded = rows.filter((row) => normalizedCode(row) === expected.code);
    const candidates = rows.filter((row) => named.includes(row) || coded.includes(row));
    const reasons: string[] = [];
    if (named.length > 1) reasons.push('More than one row has the expected branch name.');
    if (coded.length > 1) reasons.push('More than one row uses the expected code.');
    if (coded.some((row) => !named.includes(row))) {
      reasons.push('The expected code is occupied by a different branch name.');
    }
    if (candidates.some((row) => row.id && repeatedIds.has(row.id))) {
      reasons.push('A candidate database ID appears more than once in the export.');
    }
    let status: BranchReconciliationStatus;
    if (reasons.length) status = 'conflict';
    else if (named.length === 0) status = 'missing';
    else if (named[0] && normalizedCode(named[0]) !== expected.code) status = 'code_mismatch';
    else status = 'matched';
    return { expected, status, candidates, reasons };
  });
  const unmapped = rows.filter(
    (row) =>
      !NAVIERAMAR_BRANCH_CODES.some(
        (expected) => normalizeBranchIdentity(row.name) === normalizeBranchIdentity(expected.name),
      ),
  );
  return {
    readOnly: true as const,
    reviewedRows: rows.length,
    matchedCount: mappings.filter((mapping) => mapping.status === 'matched').length,
    requiresReview: mappings.some((mapping) => mapping.status !== 'matched'),
    mappings,
    unmapped,
  };
}
