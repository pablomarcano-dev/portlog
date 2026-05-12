import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// bblUnit: open question with client — expected values are "BBL", "MT", "KG", "LT"
// Using permissive string until the full enum is confirmed.
export const CargoCreateSchema = z.object({
  name: z.string().min(1).max(120),
  bblUnit: z.string().min(1).max(10),
  comments: z.string().max(10_000).optional(),
});

export const CargoUpdateSchema = CargoCreateSchema.partial();

export const CargoListQuerySchema = ListQuerySchema;

export type CargoCreateInput = z.infer<typeof CargoCreateSchema>;
export type CargoUpdateInput = z.infer<typeof CargoUpdateSchema>;
export type CargoListQuery = z.infer<typeof CargoListQuerySchema>;
