import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const ServiceCreateSchema = z.object({
  name: z.string().min(1).max(120),
  comments: z.string().max(10_000).optional(),
});

export const ServiceUpdateSchema = ServiceCreateSchema.partial();

export const ServiceListQuerySchema = ListQuerySchema;

export type ServiceCreateInput = z.infer<typeof ServiceCreateSchema>;
export type ServiceUpdateInput = z.infer<typeof ServiceUpdateSchema>;
export type ServiceListQuery = z.infer<typeof ServiceListQuerySchema>;
