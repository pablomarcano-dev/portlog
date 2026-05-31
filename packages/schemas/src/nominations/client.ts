import { z } from 'zod';

// ---------------------------------------------------------------------------
// NominationClient — single row in the CLIENT LIST table on a nomination
// Represents Type / Name / Voy / Ref No / Broker entries from the legacy UI.
// ---------------------------------------------------------------------------

export const NominationClientSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().max(100),
  name: z.string().max(200),
  voyageRef: z.string().max(50).optional().nullable(),
  referenceNo: z.string().max(100).optional().nullable(),
  proforma: z.string().max(200).optional().nullable(),
  broker: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const NominationClientCreateSchema = NominationClientSchema.omit({ id: true });
export const NominationClientUpdateSchema = NominationClientCreateSchema.partial();

export type NominationClientCreate = z.infer<typeof NominationClientCreateSchema>;
export type NominationClientUpdate = z.infer<typeof NominationClientUpdateSchema>;
export type NominationClient = z.infer<typeof NominationClientSchema>;
