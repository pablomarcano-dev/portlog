import { z } from 'zod';

export const NominationFeatureSchema = z.object({
  product: z.string().min(1).max(100),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  // "LOAD" / "DISCHARGE" — kept as free text per legacy app
  operation: z.string().min(1).max(50),
});

export type NominationFeature = z.infer<typeof NominationFeatureSchema>;
