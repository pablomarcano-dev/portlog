import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const ActivityCreateSchema = z.object({
  name: z.string().min(1).max(120),
  comments: z.string().max(10_000).optional(),
});

export const ActivityUpdateSchema = ActivityCreateSchema.partial();

export const ActivityListQuerySchema = ListQuerySchema;

export type ActivityCreateInput = z.infer<typeof ActivityCreateSchema>;
export type ActivityUpdateInput = z.infer<typeof ActivityUpdateSchema>;
export type ActivityListQuery = z.infer<typeof ActivityListQuerySchema>;
