import { z } from 'zod';

export const ListQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().positive().max(200).default(50),
  cursor: z.string().optional(),
});

export type ListQuery = z.infer<typeof ListQuerySchema>;
