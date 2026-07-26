import { z } from 'zod';
import { optionalText, optionalUrl } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

// Owner fields.
// historyJson: JSON blob for Buques / OTs / Factura / PagosRecibidos — full
//   relational normalization deferred to a future milestone.
// agreements: financial field, access gated by "owner.financial" permission (M2-S12).
export const OwnerCreateSchema = z.object({
  name: z.string().min(1).max(120),
  contactList: optionalText(120),
  quantity: z.number().int().nonnegative().optional(),
  contactNumber: optionalText(50),
  physicalAddress: optionalText(500),
  phones: optionalText(200),
  address: optionalText(500),
  position: optionalText(120),
  socialMedia: optionalText(500),
  notes: z.string().max(10_000).optional(),
  birthday: optionalText(50),
  preferences: z.string().max(10_000).optional(),
  recommendations: z.string().max(10_000).optional(),
  business: z.string().max(10_000).optional(),
  webpage: optionalUrl(),
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
