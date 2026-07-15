import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

export const CrewCreateSchema = z.object({
  name: z.string().min(1).max(120),
  position: z.string().max(120).optional(),
  documentNumber: z.string().max(50).optional(),
  nationality: z.string().max(120).optional(),
  comments: z.string().max(10_000).optional(),
});

export const CrewUpdateSchema = CrewCreateSchema.partial();

export const CrewListQuerySchema = ListQuerySchema;

export type CrewCreateInput = z.infer<typeof CrewCreateSchema>;
export type CrewUpdateInput = z.infer<typeof CrewUpdateSchema>;
export type CrewListQuery = z.infer<typeof CrewListQuerySchema>;
