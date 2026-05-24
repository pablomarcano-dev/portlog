import { z } from 'zod';

// ---------------------------------------------------------------------------
// PedrStage enum
// ---------------------------------------------------------------------------
export const pedrStageSchema = z.enum(['PRE_ARRIVAL', 'ATTENDING', 'DISPATCH', 'CLOSING']);
export type PedrStage = z.infer<typeof pedrStageSchema>;

// Stage ordering for forward-only transition validation
const STAGE_ORDER: PedrStage[] = ['PRE_ARRIVAL', 'ATTENDING', 'DISPATCH', 'CLOSING'];

/**
 * Returns true only if `to` is the immediate next stage after `from`.
 * Stages advance strictly forward one step at a time — no skipping.
 */
export function isValidPedrStageTransition(from: PedrStage, to: PedrStage): boolean {
  const fromIndex = STAGE_ORDER.indexOf(from);
  const toIndex = STAGE_ORDER.indexOf(to);
  return toIndex === fromIndex + 1;
}

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------
export const createPedrSchema = z.object({
  nominationId: z.string().uuid(),
});
export type CreatePedrInput = z.infer<typeof createPedrSchema>;

export const updatePedrRequirementsSchema = z.object({
  requirements: z.record(z.unknown()),
});
export type UpdatePedrRequirementsInput = z.infer<typeof updatePedrRequirementsSchema>;

// ---------------------------------------------------------------------------
// Stage transition
// ---------------------------------------------------------------------------
export const pedrStageTransitionSchema = z.object({
  toStage: pedrStageSchema,
  reason: z.string().optional(),
});
export type PedrStageTransition = z.infer<typeof pedrStageTransitionSchema>;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------
export const pedrListQuerySchema = z.object({
  stage: pedrStageSchema.optional(),
  nominationSearch: z.string().optional(),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().uuid().optional(),
});
export type PedrListQuery = z.infer<typeof pedrListQuerySchema>;

// ---------------------------------------------------------------------------
// Response shape — full Pedr row
// ---------------------------------------------------------------------------
export const pedrResponseSchema = z.object({
  id: z.string().uuid(),
  nominationId: z.string().uuid(),
  currentStage: pedrStageSchema,
  requirements: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PedrResponse = z.infer<typeof pedrResponseSchema>;
