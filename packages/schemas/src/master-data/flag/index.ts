import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const FlagCreateSchema = z.object({
  name: z.string().min(1).max(120),
  abbreviation: z.string().min(1).max(20).optional(),
  comments: z.string().max(10_000).optional(),
});

export const FlagUpdateSchema = FlagCreateSchema.partial();

export const FlagListQuerySchema = ListQuerySchema;

export type FlagCreateInput = z.infer<typeof FlagCreateSchema>;
export type FlagUpdateInput = z.infer<typeof FlagUpdateSchema>;
export type FlagListQuery = z.infer<typeof FlagListQuerySchema>;
