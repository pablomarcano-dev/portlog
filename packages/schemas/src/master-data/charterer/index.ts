import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const ChartererCreateSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().min(1).max(500).optional(),
  contactInfo: z.string().max(10_000).optional(),
  comments: z.string().max(10_000).optional(),
});

export const ChartererUpdateSchema = ChartererCreateSchema.partial();

export const ChartererListQuerySchema = ListQuerySchema;

export type ChartererCreateInput = z.infer<typeof ChartererCreateSchema>;
export type ChartererUpdateInput = z.infer<typeof ChartererUpdateSchema>;
export type ChartererListQuery = z.infer<typeof ChartererListQuerySchema>;
