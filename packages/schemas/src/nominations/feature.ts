import { z } from 'zod';

// Strict schema — used for create/update validation
export const NominationFeatureSchema = z.object({
  product: z.string().min(1).max(100),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  // "LOAD" / "DISCHARGE" — kept as free text per legacy app
  operation: z.string().min(1).max(50),
});

// Lenient schema — used when parsing API responses (existing rows may have nulls)
export const NominationFeatureReadSchema = z.object({
  product: z.string(),
  quantity: z.coerce.number().nullable().optional(),
  unit: z.string(),
  operation: z.string().nullable().optional(),
});

export type NominationFeature = z.infer<typeof NominationFeatureSchema>;
export type NominationFeatureRead = z.infer<typeof NominationFeatureReadSchema>;
