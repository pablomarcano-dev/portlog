import { z } from 'zod';

export const NominationStatusSchema = z.enum([
  'DRAFT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const NominationTypeSchema = z.enum([
  'FULL_AGENCY',
  'OWNERS_AGENTS_ONLY',
  'CHARTERERS_AGENTS_ONLY',
]);

export type NominationStatus = z.infer<typeof NominationStatusSchema>;
export type NominationType = z.infer<typeof NominationTypeSchema>;
