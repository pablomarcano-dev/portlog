import { z } from 'zod';
import { pedrStageSchema } from './pedr.js';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------
export const createDocumentSchema = z.object({
  pedrId: z.string().uuid(),
  subDocumentId: z.string().uuid().optional(),
  stage: pedrStageSchema,
  docType: z.string().min(1),
  minioKey: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().optional(),
});
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;

// ---------------------------------------------------------------------------
// Response shape — full Document row
// ---------------------------------------------------------------------------
export const documentResponseSchema = z.object({
  id: z.string().uuid(),
  nominationId: z.string().uuid(),
  pedrId: z.string().uuid().nullable(),
  subDocumentId: z.string().uuid().nullable(),
  stage: pedrStageSchema,
  docType: z.string(),
  minioKey: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nullable(),
  createdById: z.string(),
  createdAt: z.string().datetime(),
});
export type DocumentResponse = z.infer<typeof documentResponseSchema>;
