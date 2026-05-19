import { z } from 'zod';

// ---------------------------------------------------------------------------
// PedrEventKind enum
// ---------------------------------------------------------------------------
export const pedrEventKindSchema = z.enum([
  'ARRIVED',
  'ANCHORED',
  'NOR_TENDERED',
  'LOADING_START',
  'LOADING_END',
  'DISCHARGE_START',
  'DISCHARGE_END',
  'DEPARTED',
  'OTHER',
]);
export type PedrEventKind = z.infer<typeof pedrEventKindSchema>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export const createPedrEventSchema = z.object({
  pedrId: z.string().uuid(),
  subDocumentId: z.string().uuid().optional(),
  kind: pedrEventKindSchema,
  // Legally recorded timestamp — when the real-world event happened
  occurredAt: z.string().datetime(),
  note: z.string().optional(),
});
export type CreatePedrEventInput = z.infer<typeof createPedrEventSchema>;

// ---------------------------------------------------------------------------
// Response shape — full PedrEvent row
// ---------------------------------------------------------------------------
export const pedrEventResponseSchema = z.object({
  id: z.string().uuid(),
  pedrId: z.string().uuid(),
  subDocumentId: z.string().uuid().nullable(),
  kind: pedrEventKindSchema,
  occurredAt: z.string().datetime(),
  note: z.string().nullable(),
  recordedById: z.string(),
  recordedAt: z.string().datetime(),
});
export type PedrEventResponse = z.infer<typeof pedrEventResponseSchema>;
