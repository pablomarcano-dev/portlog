import { z } from 'zod';

// ---------------------------------------------------------------------------
// SubDocType enum — mirrors Prisma SubDocType enum in dispatch.prisma
// ---------------------------------------------------------------------------
export const subDocTypeSchema = z.enum([
  'ACKNOWLEDGEMENT',
  'PREARRIVAL',
  'ETA_ETB',
  'NOR',
  'SOF',
  'CARGO_UPDATE',
]);
export type SubDocType = z.infer<typeof subDocTypeSchema>;

// ---------------------------------------------------------------------------
// Send sub-document — POST /dispatch/pedr/:pedrId/sub-document
// ---------------------------------------------------------------------------
export const sendSubDocumentSchema = z.object({
  subDocType: subDocTypeSchema,
  toAddresses: z.array(z.string().email()).min(1, 'At least one recipient required'),
  ccAddresses: z.array(z.string().email()).default([]),
  subject: z.string().min(1).max(500),
  bodyHtml: z.string().optional(),
});
export type SendSubDocumentInput = z.infer<typeof sendSubDocumentSchema>;

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
