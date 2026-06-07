import { z } from 'zod';

export const SHDocumentTypeSchema = z.enum([
  'SH_66A',
  'SH_09A',
  'SH_28A',
  'SH_29A',
  'COMMENT',
  'OTHER',
]);
export type SHDocumentType = z.infer<typeof SHDocumentTypeSchema>;

export const SHDocumentStatusSchema = z.enum(['DRAFT', 'FINALIZED', 'SENT']);
export type SHDocumentStatus = z.infer<typeof SHDocumentStatusSchema>;

// ---------------------------------------------------------------------------
// Per-type data schemas
// ---------------------------------------------------------------------------

const Sh66aDataSchema = z.object({
  type: z.literal('SH_66A'),
  vesselReference: z.string().optional(),
  rows: z.array(
    z.object({
      date: z.string(), // YYYY-MM-DD
      from: z.string(), // HH:mm
      to: z.string(), // HH:mm
      activity: z.string(),
    }),
  ),
  notes: z.string().optional(),
});

const Sh09aDataSchema = z.object({
  type: z.literal('SH_09A'),
  patientName: z.string().min(1),
  rank: z.string().optional(),
  vesselName: z.string().optional(),
  diagnosis: z.string().optional(),
  body: z.string().min(1),
  issuedAt: z.string().optional(),
});

const SparesDataSchema = z.object({
  awbOrInvoice: z.string().optional(),
  supplier: z.string().optional(),
  rows: z.array(
    z.object({
      description: z.string(),
      qty: z.number().positive(),
      unit: z.string().optional(),
      weightKg: z.number().optional(),
    }),
  ),
  receivedBy: z.string().optional(),
});

const Sh28aDataSchema = SparesDataSchema.extend({ type: z.literal('SH_28A') });
const Sh29aDataSchema = SparesDataSchema.extend({ type: z.literal('SH_29A') });

const AttachmentRefSchema = z.object({
  minioKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
});

const CommentDataSchema = z.object({
  type: z.literal('COMMENT'),
  html: z.string(),
});

const OtherDataSchema = z.object({
  type: z.literal('OTHER'),
  html: z.string(),
  attachments: z.array(AttachmentRefSchema).optional(),
});

export const SHDocumentDataSchema = z.discriminatedUnion('type', [
  Sh66aDataSchema,
  Sh09aDataSchema,
  Sh28aDataSchema,
  Sh29aDataSchema,
  CommentDataSchema,
  OtherDataSchema,
]);
export type SHDocumentData = z.infer<typeof SHDocumentDataSchema>;

// ---------------------------------------------------------------------------
// CRUD schemas
// ---------------------------------------------------------------------------

export const CreateSHDocumentSchema = z.object({
  type: SHDocumentTypeSchema,
  title: z.string().max(255).optional(),
  data: z.record(z.any()).optional().default({}),
});
export type CreateSHDocumentInput = z.infer<typeof CreateSHDocumentSchema>;

export const UpdateSHDocumentSchema = z.object({
  title: z.string().max(255).optional(),
  data: z.record(z.any()),
});
export type UpdateSHDocumentInput = z.infer<typeof UpdateSHDocumentSchema>;

export const SendShDocumentSchema = z.object({
  toAddresses: z.array(z.string().email()).min(1),
  ccAddresses: z.array(z.string().email()).optional().default([]),
  subject: z.string().max(500).optional(),
  bodyHtml: z.string().optional(),
});
export type SendShDocumentInput = z.infer<typeof SendShDocumentSchema>;

// ---------------------------------------------------------------------------
// All-Sent dashboard schemas
// ---------------------------------------------------------------------------

export const AllSentFiltersSchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  portId: z.string().cuid().optional(),
  nominationId: z.string().uuid().optional(),
});
export type AllSentFilters = z.infer<typeof AllSentFiltersSchema>;

const TRACKER_TYPES = ['SH_66A', 'SH_09A', 'SH_28A', 'SH_29A'] as const;
export type TrackerDocType = (typeof TRACKER_TYPES)[number];

export const CellStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('PENDING'),
    shDocumentId: z.string().optional(),
  }),
  z.object({
    status: z.literal('SENT'),
    shDocumentId: z.string(),
    sentAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    status: z.literal('FAILED'),
    shDocumentId: z.string(),
    error: z.string(),
  }),
]);
export type CellStatus = z.infer<typeof CellStatusSchema>;

export const AllSentRowSchema = z.object({
  nominationId: z.string(),
  correlative: z.string(),
  vesselName: z.string().nullable(),
  portName: z.string().nullable(),
  portAbbreviation: z.string().nullable(),
  etaDate: z.string().nullable(),
  cells: z.object({
    SH_66A: CellStatusSchema,
    SH_09A: CellStatusSchema,
    SH_28A: CellStatusSchema,
    SH_29A: CellStatusSchema,
  }),
});
export type AllSentRow = z.infer<typeof AllSentRowSchema>;

export const AllSentResponseSchema = z.object({
  rows: z.array(AllSentRowSchema),
});
export type AllSentResponse = z.infer<typeof AllSentResponseSchema>;

// ---------------------------------------------------------------------------
// DTO (output shape)
// ---------------------------------------------------------------------------

export type SHDocumentDto = {
  id: string;
  nominationId: string;
  type: SHDocumentType;
  status: SHDocumentStatus;
  title: string | null;
  data: unknown;
  minioKey: string | null;
  pdfGeneratedAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; email: string };
};
