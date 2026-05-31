import { z } from 'zod';

export const PierCreateSchema = z.object({
  name: z.string().min(1).max(120),
  portId: z.string().cuid(),
});

export const PierUpdateSchema = z.object({
  name: z.string().min(1).max(120),
});

export const PierSchema = z.object({
  id: z.string().cuid(),
  name: z.string(),
  portId: z.string().cuid(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type PierCreateInput = z.infer<typeof PierCreateSchema>;
export type PierUpdateInput = z.infer<typeof PierUpdateSchema>;
export type Pier = z.infer<typeof PierSchema>;
