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

// --- Template CRUD schemas ---

export const CreateBranchDocumentTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, 'Must be uppercase letters, digits, or underscores'),
  description: z.string().max(500).nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateBranchDocumentTemplateInput = z.infer<typeof CreateBranchDocumentTemplateSchema>;

export const UpdateBranchDocumentTemplateSchema = CreateBranchDocumentTemplateSchema.partial();
export type UpdateBranchDocumentTemplateInput = z.infer<typeof UpdateBranchDocumentTemplateSchema>;

// --- Field CRUD schemas ---

export const CreateBranchDocumentTemplateFieldSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9_]+$/, 'Must be snake_case'),
  label: z.string().min(1).max(200),
  type: BranchDocumentFieldTypeSchema,
  required: z.boolean().default(false),
  sourceField: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  options: z.array(z.string()).default([]),
  sortOrder: z.number().int().min(0).default(0),
});
export type CreateBranchDocumentTemplateFieldInput = z.infer<
  typeof CreateBranchDocumentTemplateFieldSchema
>;

export const UpdateBranchDocumentTemplateFieldSchema =
  CreateBranchDocumentTemplateFieldSchema.partial();
export type UpdateBranchDocumentTemplateFieldInput = z.infer<
  typeof UpdateBranchDocumentTemplateFieldSchema
>;

export const ReorderTemplateFieldsSchema = z.array(
  z.object({ id: z.string(), sortOrder: z.number().int().min(0) }),
);
export type ReorderTemplateFieldsInput = z.infer<typeof ReorderTemplateFieldsSchema>;

// HBS file content uploaded as JSON (avoids multipart infrastructure)
export const UploadHbsSchema = z.object({
  content: z.string().min(1, 'Template content cannot be empty'),
});
export type UploadHbsInput = z.infer<typeof UploadHbsSchema>;
