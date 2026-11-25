import type { NominationKind } from './enums.js';

/** Format an already assigned number. This never allocates or advances a counter. */
export function formatNewNominationReference(
  correlative: number,
  dateNominated: Date,
  kind: NominationKind,
  branchCode: string,
): string {
  if (!Number.isSafeInteger(correlative) || correlative < 1) {
    throw new Error('An assigned positive nomination number is required.');
  }
  if (!Number.isFinite(dateNominated.getTime())) {
    throw new Error('A valid nomination opening date is required.');
  }
  const branch = branchCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{1,20}$/.test(branch)) {
    throw new Error('A branch code is required before issuing a nomination reference.');
  }
  const year = String(dateNominated.getUTCFullYear()).slice(-2);
  return `${kind}${String(correlative).padStart(4, '0')}/${year}/${branch}`;
}

export interface NominationReferenceSource {
  correlative: number;
  dateNominated: Date;
  kind: NominationKind;
  /** Immutable snapshot issued by this application; absent on legacy records. */
  businessReference?: string | null;
  /** Existing agency-issued override, preserved verbatim for historical records. */
  administrativeSnOt?: string | null;
  branch?: { code?: string | null } | null;
}

/**
 * A snapshot identifies the new-format records explicitly. A legacy record is
 * never inferred from its date, sequence, branch, or a similarity to the new format.
 */
export function resolveNominationReference(
  source: NominationReferenceSource,
  legacyStyle: 'internal' | 'notice' | 'internal-utc' = 'internal',
): string {
  if (source.businessReference) return source.businessReference;
  if (source.administrativeSnOt?.trim()) return source.administrativeSnOt.trim();
  // Retain each legacy caller's existing year convention. New snapshots above
  // are independent of this fallback and use the explicit UTC opening year.
  const year = String(
    legacyStyle === 'internal-utc'
      ? source.dateNominated.getUTCFullYear()
      : source.dateNominated.getFullYear(),
  ).slice(-2);
  if (legacyStyle !== 'notice') {
    return `${source.kind}-${year}/${String(source.correlative).padStart(4, '0')}`;
  }
  const parts = [`${source.kind}${source.correlative}`, year];
  if (source.branch?.code != null) parts.push(source.branch.code);
  return parts.join('/');
}
