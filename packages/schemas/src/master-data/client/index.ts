import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const ClientCreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().max(50).optional(),
  phone2: z.string().max(50).optional(),
  physicalAddress: z.string().max(500).optional(),
  billingAddress: z.string().max(500).optional(),
  postalAddress: z.string().max(500).optional(),
  taxAddress: z.string().max(500).optional(),
  otherAddress: z.string().max(500).optional(),
  fax: z.string().max(50).optional(),
  mobile: z.string().max(50).optional(),
  email: z.string().max(200).optional(),
  emailGroup: z.string().max(200).optional(),
  tariff: z.string().max(100_000).optional(),
  instructions: z.string().max(10_000).optional(),
});

export const ClientUpdateSchema = ClientCreateSchema.partial();

export const ClientListQuerySchema = ListQuerySchema;

export type ClientCreateInput = z.infer<typeof ClientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof ClientUpdateSchema>;
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>;
