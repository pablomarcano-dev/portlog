import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const PortCreateSchema = z.object({
  name: z.string().min(1).max(120),
  abbreviation: z.string().min(1).max(20).optional(),
  location: z.string().min(1).max(120).optional(),
  parentId: z.string().cuid().optional(),
  comments: z.string().max(10_000).optional(),
});

export const PortUpdateSchema = PortCreateSchema.partial();

export const PortListQuerySchema = ListQuerySchema.extend({
  parentId: z.string().cuid().nullish(),
});

export type PortCreateInput = z.infer<typeof PortCreateSchema>;
export type PortUpdateInput = z.infer<typeof PortUpdateSchema>;
export type PortListQuery = z.infer<typeof PortListQuerySchema>;
