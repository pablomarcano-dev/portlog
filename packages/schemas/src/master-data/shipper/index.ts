import { z } from 'zod';
import { emailList, optionalText } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

export const ShipperCreateSchema = z.object({
  name: z.string().min(1).max(120),
  emails: emailList(),
  businessPhone: optionalText(50),
  businessFax: optionalText(50),
  address: optionalText(500),
  comments: z.string().max(10_000).optional(),
});

export const ShipperUpdateSchema = ShipperCreateSchema.partial();

export const ShipperListQuerySchema = ListQuerySchema;

export type ShipperCreateInput = z.infer<typeof ShipperCreateSchema>;
export type ShipperUpdateInput = z.infer<typeof ShipperUpdateSchema>;
export type ShipperListQuery = z.infer<typeof ShipperListQuerySchema>;
