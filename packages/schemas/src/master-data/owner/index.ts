import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// Owner fields.
// historyJson: JSON blob for Buques / OTs / Factura / PagosRecibidos — full
//   relational normalization deferred to a future milestone.
// agreements: financial field, access gated by "owner.financial" permission (M2-S12).
export const OwnerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  contactList: z.string().min(1).max(120).optional(),
  quantity: z.number().int().nonnegative().optional(),
  contactNumber: z.string().min(1).max(50).optional(),
  physicalAddress: z.string().min(1).max(500).optional(),
  phones: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  position: z.string().min(1).max(120).optional(),
  socialMedia: z.string().min(1).max(500).optional(),
  notes: z.string().max(10_000).optional(),
  birthday: z.string().min(1).max(50).optional(),
  preferences: z.string().max(10_000).optional(),
  recommendations: z.string().max(10_000).optional(),
  business: z.string().max(10_000).optional(),
  webpage: z.string().url().optional(),
  agreements: z.string().max(10_000).optional(),
  historyJson: z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (!t) return undefined;
    try {
      return JSON.parse(t);
    } catch {
      return v;
    }
  }, z.record(z.unknown()).optional()),
  comments: z.string().max(10_000).optional(),
});

export const OwnerUpdateSchema = OwnerCreateSchema.partial();

export const OwnerListQuerySchema = ListQuerySchema;

export type OwnerCreateInput = z.infer<typeof OwnerCreateSchema>;
export type OwnerUpdateInput = z.infer<typeof OwnerUpdateSchema>;
export type OwnerListQuery = z.infer<typeof OwnerListQuerySchema>;
