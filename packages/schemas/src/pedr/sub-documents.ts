import { z } from 'zod';
import { pedrStageSchema } from './pedr.js';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------
export const pedrSubDocumentTypeSchema = z.enum([
  'ACKNOWLEDGEMENT',
  'PREARRIVAL',
  'ETA_ETB',
  'NOR',
  'SOF',
  'CARGO_UPDATE',
]);
export type PedrSubDocumentType = z.infer<typeof pedrSubDocumentTypeSchema>;

export const pedrSubDocumentStatusSchema = z.enum(['DRAFT', 'SENT', 'FINALIZED', 'CANCELLED']);
export type PedrSubDocumentStatus = z.infer<typeof pedrSubDocumentStatusSchema>;

// ---------------------------------------------------------------------------
// Per-type payload schemas
// ---------------------------------------------------------------------------
export const acknowledgementPayloadSchema = z.object({
  type: z.literal('ACKNOWLEDGEMENT'),
  vesselName: z.string().min(1),
  imo: z.string().min(1),
  eta: z.string().datetime(),
  remarks: z.string().optional(),
});
export type AcknowledgementPayload = z.infer<typeof acknowledgementPayloadSchema>;

export const prearrivalPayloadSchema = z.object({
  type: z.literal('PREARRIVAL'),
  vesselName: z.string().min(1),
  imo: z.string().min(1),
  eta: z.string().datetime(),
  lastPort: z.string().optional(),
  nextPort: z.string().optional(),
  cargo: z.string().optional(),
  remarks: z.string().optional(),
});
export type PrearrivalPayload = z.infer<typeof prearrivalPayloadSchema>;

export const etaEtbPayloadSchema = z.object({
  type: z.literal('ETA_ETB'),
  eta: z.string().datetime(),
  etb: z.string().datetime().optional(),
  remarks: z.string().optional(),
});
export type EtaEtbPayload = z.infer<typeof etaEtbPayloadSchema>;

export const norPayloadSchema = z.object({
  type: z.literal('NOR'),
  tenderedAt: z.string().datetime(),
  acceptedAt: z.string().datetime().optional(),
  remarks: z.string().optional(),
});
export type NorPayload = z.infer<typeof norPayloadSchema>;

export const sofPayloadSchema = z.object({
  type: z.literal('SOF'),
  signedOffAt: z.string().datetime().optional(),
  remarks: z.string().optional(),
});
export type SofPayload = z.infer<typeof sofPayloadSchema>;

export const cargoUpdateRowSchema = z.object({
  product: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  remarks: z.string().optional(),
});
export type CargoUpdateRow = z.infer<typeof cargoUpdateRowSchema>;

export const cargoUpdatePayloadSchema = z.object({
  type: z.literal('CARGO_UPDATE'),
  rows: z.array(cargoUpdateRowSchema),
});
export type CargoUpdatePayload = z.infer<typeof cargoUpdatePayloadSchema>;

// ---------------------------------------------------------------------------
// Discriminated union over all payload types
// ---------------------------------------------------------------------------
export const pedrSubDocumentPayloadSchema = z.discriminatedUnion('type', [
  acknowledgementPayloadSchema,
  prearrivalPayloadSchema,
  etaEtbPayloadSchema,
  norPayloadSchema,
  sofPayloadSchema,
  cargoUpdatePayloadSchema,
]);
export type PedrSubDocumentPayload = z.infer<typeof pedrSubDocumentPayloadSchema>;

// ---------------------------------------------------------------------------
// Recipient shape (reused in create/response)
// ---------------------------------------------------------------------------
export const pedrSubDocumentRecipientSchema = z.object({
  contactId: z.string().uuid().optional(),
  email: z.string().email(),
  name: z.string().optional(),
});
export type PedrSubDocumentRecipient = z.infer<typeof pedrSubDocumentRecipientSchema>;

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------
export const createPedrSubDocumentSchema = z.object({
  pedrId: z.string().uuid(),
  type: pedrSubDocumentTypeSchema,
  payload: pedrSubDocumentPayloadSchema,
  recipients: z.array(pedrSubDocumentRecipientSchema).optional(),
  body: z.string().optional(),
});
export type CreatePedrSubDocumentInput = z.infer<typeof createPedrSubDocumentSchema>;

export const updatePedrSubDocumentSchema = createPedrSubDocumentSchema
  .omit({ pedrId: true, type: true })
  .partial();
export type UpdatePedrSubDocumentInput = z.infer<typeof updatePedrSubDocumentSchema>;

// ---------------------------------------------------------------------------
// Response shape — full PedrSubDocument row
// ---------------------------------------------------------------------------
export const pedrSubDocumentResponseSchema = z.object({
  id: z.string().uuid(),
  pedrId: z.string().uuid(),
  type: pedrSubDocumentTypeSchema,
  status: pedrSubDocumentStatusSchema,
  stage: pedrStageSchema,
  payload: z.record(z.unknown()),
  recipients: z.array(pedrSubDocumentRecipientSchema),
  body: z.string().nullable(),
  finalizedAt: z.string().datetime().nullable(),
  finalizedById: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PedrSubDocumentResponse = z.infer<typeof pedrSubDocumentResponseSchema>;
