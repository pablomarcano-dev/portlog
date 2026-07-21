import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// Product classification. SN products may be used on any nomination; OT products
// are the only ones an OT nomination accepts (see NominationKind). Defaults to SN
// so existing catalog rows keep today's unrestricted behavior.
export const CargoCategorySchema = z.enum(['SN', 'OT']);

// bblUnit: open question with client — expected values are "BBL", "MT", "KG", "LT"
// Using permissive string until the full enum is confirmed.
export const CargoCreateSchema = z.object({
  name: z.string().min(1).max(120),
  bblUnit: z.string().min(1).max(10),
  category: CargoCategorySchema.default('SN'),
  comments: z.string().max(10_000).optional(),
});

export const CargoUpdateSchema = CargoCreateSchema.partial();

// Extends the shared list query with an optional category filter — the OT product
// picker requests `category=OT` so it only suggests OT-eligible products.
export const CargoListQuerySchema = ListQuerySchema.extend({
  category: CargoCategorySchema.optional(),
});

export type CargoCategory = z.infer<typeof CargoCategorySchema>;
export type CargoCreateInput = z.infer<typeof CargoCreateSchema>;
export type CargoUpdateInput = z.infer<typeof CargoUpdateSchema>;
export type CargoListQuery = z.infer<typeof CargoListQuerySchema>;
