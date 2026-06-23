import { z } from 'zod';

export const BranchDocumentFieldTypeSchema = z.enum([
  'TEXT',
  'DATE',
  'DATETIME',
  'NUMBER',
  'TEXTAREA',
  'SELECT',
]);
export type BranchDocumentFieldType = z.infer<typeof BranchDocumentFieldTypeSchema>;

export const BranchDocumentStatusSchema = z.enum(['DRAFT', 'FINALIZED']);
export type BranchDocumentStatus = z.infer<typeof BranchDocumentStatusSchema>;

// ---------------------------------------------------------------------------
// Template field DTO
// ---------------------------------------------------------------------------
export const BranchDocumentTemplateFieldDto = z.object({
  id: z.string(),
  templateId: z.string(),
  key: z.string(),
  label: z.string(),
  type: BranchDocumentFieldTypeSchema,
  required: z.boolean(),
  sourceField: z.string().nullable(),
  placeholder: z.string().nullable(),
  options: z.array(z.string()),
  sortOrder: z.number(),
});
export type BranchDocumentTemplateField = z.infer<typeof BranchDocumentTemplateFieldDto>;

// ---------------------------------------------------------------------------
// Template DTO
// ---------------------------------------------------------------------------
export const BranchDocumentTemplateDto = z.object({
  id: z.string(),
  branchId: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string().nullable(),
  hbsTemplate: z.string(),
  fields: z.array(BranchDocumentTemplateFieldDto),
  sortOrder: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BranchDocumentTemplate = z.infer<typeof BranchDocumentTemplateDto>;

// ---------------------------------------------------------------------------
// Instance DTOs
// ---------------------------------------------------------------------------
export const BranchDocumentInstanceDto = z.object({
  id: z.string(),
  templateId: z.string(),
  nominationId: z.string(),
  data: z.record(z.unknown()),
  status: BranchDocumentStatusSchema,
  title: z.string().nullable(),
  minioKey: z.string().nullable(),
  pdfGeneratedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.object({ id: z.string(), email: z.string() }),
  template: z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    fields: z.array(BranchDocumentTemplateFieldDto),
  }),
});
export type BranchDocumentInstance = z.infer<typeof BranchDocumentInstanceDto>;

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------
export const CreateBranchDocumentInstanceSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().optional(),
  data: z.record(z.unknown()).default({}),
});
export type CreateBranchDocumentInstanceInput = z.infer<typeof CreateBranchDocumentInstanceSchema>;

export const UpdateBranchDocumentInstanceSchema = z.object({
  title: z.string().optional(),
  data: z.record(z.unknown()),
});
export type UpdateBranchDocumentInstanceInput = z.infer<typeof UpdateBranchDocumentInstanceSchema>;
