import { z } from 'zod';
import { attachmentIdsSchema } from '../attachments/index.js';

// ---------------------------------------------------------------------------
// SubDocType enum — mirrors Prisma SubDocType enum in dispatch.prisma
// ---------------------------------------------------------------------------
export const subDocTypeSchema = z.enum([
  'ACKNOWLEDGEMENT',
  'PREARRIVAL',
  'ETA_ETB',
  'ETA_REQUEST',
  'ETA_TERMINAL',
  'ETA_REPLY',
  'NOR',
  'SOF',
  'CARGO_UPDATE',
]);
export type SubDocType = z.infer<typeof subDocTypeSchema>;

// ---------------------------------------------------------------------------
// Send sub-document — POST /dispatch/pedr/:pedrId/sub-document
// ---------------------------------------------------------------------------

// extraData carries sub-document-specific fields that are transient (not
// stored in a dedicated column). Each sub-doc type uses a subset of these.
export const subDocExtraDataSchema = z.object({
  etb: z.string().optional(), // ETA_ETB: estimated time of berthing
  berthNumber: z.string().optional(), // ETA_ETB: berth assignment
  etcDate: z.string().optional(), // ETA_ETB: estimated time of completion
  norTenderedAt: z.string().optional(), // NOR: when NOR was tendered (required for NOR dispatch)
  norAcceptedAt: z.string().optional(), // NOR: when NOR was accepted (optional)
  layTimeCommences: z.string().optional(), // NOR: when lay time commences (optional)
  blQuantity: z.number().optional(), // CARGO_UPDATE: bill of lading quantity
  blDate: z.string().optional(), // CARGO_UPDATE: bill of lading date (ISO date string)
  vesselFigure: z.number().optional(), // CARGO_UPDATE: vessel figure (optional)
  shoreFigure: z.number().optional(), // CARGO_UPDATE: shore figure (optional)
  remarks: z.string().optional(), // CARGO_UPDATE: remarks (optional)
});
export type SubDocExtraData = z.infer<typeof subDocExtraDataSchema>;

export const sendSubDocumentSchema = z.object({
  subDocType: subDocTypeSchema,
  toAddresses: z.array(z.string().email()).min(1, 'At least one recipient required'),
  ccAddresses: z.array(z.string().email()).default([]),
  bccAddresses: z.array(z.string().email()).default([]),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().optional(),
  extraData: subDocExtraDataSchema.optional(),
  // IDs of previously uploaded EmailAttachment rows to attach (in addition to
  // the generated sub-document PDF).
  attachmentIds: attachmentIdsSchema,
});
export type SendSubDocumentInput = z.infer<typeof sendSubDocumentSchema>;

// ---------------------------------------------------------------------------
// Send nomination-level email — POST /nominations/:id/send-email
// ---------------------------------------------------------------------------
// Nomination-level messages (ACKNOWLEDGEMENT, PREARRIVAL, ETA_REQUEST,
// ETA_TERMINAL, ETA_REPLY, CARGO_UPDATE, re-sends). Unlike sub-document
// dispatch, there is no generated PDF — only user-supplied attachments.
export const sendNominationEmailSchema = z.object({
  subDocType: subDocTypeSchema,
  toAddresses: z.array(z.string().email()).min(1, 'At least one recipient required'),
  ccAddresses: z.array(z.string().email()).default([]),
  bccAddresses: z.array(z.string().email()).default([]),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().default(''),
  attachmentIds: attachmentIdsSchema,
});
export type SendNominationEmailInput = z.infer<typeof sendNominationEmailSchema>;

// ---------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------
export const emailDispatchResponseSchema = z.object({
  id: z.string(),
  pedrId: z.string(),
  subDocType: subDocTypeSchema,
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  subject: z.string(),
  bodyHtml: z.string().nullable(),
  pdfStorageKey: z.string().nullable(),
  sentAt: z.string().datetime().nullable(),
  sentById: z.string(),
  error: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type EmailDispatchResponse = z.infer<typeof emailDispatchResponseSchema>;

export const dispatchLogResponseSchema = z.object({
  items: z.array(emailDispatchResponseSchema),
});
export type DispatchLogResponse = z.infer<typeof dispatchLogResponseSchema>;
