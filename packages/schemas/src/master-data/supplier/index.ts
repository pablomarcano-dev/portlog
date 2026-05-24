import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// Supplier fields.
export const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(120),
  contacts: z.string().max(10_000).optional(),
  address: z.string().min(1).max(500).optional(),
  services: z.string().max(10_000).optional(),
  kyc: z.string().max(10_000).optional(),
  phones: z.string().min(1).max(200).optional(),
  emails: z.string().max(10_000).optional(),
  certificates: z.string().max(10_000).optional(),
  rates: z.string().max(10_000).optional(),
  serviceContract: z.string().max(10_000).optional(),
  agreements: z.string().max(10_000).optional(),
  comments: z.string().max(10_000).optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export const SupplierListQuerySchema = ListQuerySchema;

export type SupplierCreateInput = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof SupplierUpdateSchema>;
export type SupplierListQuery = z.infer<typeof SupplierListQuerySchema>;
