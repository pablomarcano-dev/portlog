import type { NominationKind } from '@portlog/schemas';

export function formatSnOt(correlative: number, dateNominated: Date, kind: NominationKind): string {
  const yy = String(dateNominated.getFullYear()).slice(-2);
  const prefix = kind === 'OT' ? 'OT' : 'SN';
  return `${prefix}-${yy}/${String(correlative).padStart(4, '0')}`;
}

export function formatNominationNoticeReference(
  correlative: number,
  dateNominated: Date,
  kind: NominationKind,
  branchCode: string | null,
): string {
  const yy = String(dateNominated.getFullYear()).slice(-2);
  const prefix = kind === 'OT' ? 'OT' : 'SN';
  const parts = [`${prefix}${correlative}`, yy];
  if (branchCode !== null) parts.push(branchCode);
  return parts.join('/');
}
