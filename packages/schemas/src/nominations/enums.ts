import { z } from 'zod';

// Nomination lifecycle. NOMINATED / IN_PORT / FULL_AWAY are DERIVED from facts
// (see deriveNominationStatus in status.ts) and are never manually assigned.
// Only NOMINATED (the default) and CANCELLED are ever persisted in the DB column;
// CANCELLED is a manual override that wins over the derived value.
export const NominationStatusSchema = z.enum(['NOMINATED', 'IN_PORT', 'FULL_AWAY', 'CANCELLED']);

export const NominationTypeSchema = z.enum([
  'FULL_AGENCY',
  'OWNERS_AGENTS_ONLY',
  'CHARTERERS_AGENTS_ONLY',
]);

// Nomination series/kind. Distinct from NominationType (agency arrangement).
// SN behaves exactly as before (any product); OT nominations only accept products
// marked with the matching OT cargo category. Chosen at creation and then immutable.
export const NominationKindSchema = z.enum(['SN', 'OT']);

export type NominationStatus = z.infer<typeof NominationStatusSchema>;
export type NominationType = z.infer<typeof NominationTypeSchema>;
export type NominationKind = z.infer<typeof NominationKindSchema>;
