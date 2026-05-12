import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const ShipperCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().optional(),
  businessPhone: z.string().min(1).max(50).optional(),
  businessFax: z.string().min(1).max(50).optional(),
  address: z.string().min(1).max(500).optional(),
  comments: z.string().max(10_000).optional(),
});

export const ShipperUpdateSchema = ShipperCreateSchema.partial();

export const ShipperListQuerySchema = ListQuerySchema;

export type ShipperCreateInput = z.infer<typeof ShipperCreateSchema>;
export type ShipperUpdateInput = z.infer<typeof ShipperUpdateSchema>;
export type ShipperListQuery = z.infer<typeof ShipperListQuerySchema>;
