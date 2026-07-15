import { z } from 'zod';

// Master-data FKs are cuid ids (same convention as schemas.ts)
const cuidFk = z.string().cuid();

/**
 * Sale — a service sold against a nomination (SALES modal on nomination detail).
 * price is a plain amount — currency is deliberately out of scope for now
 * (see .claude/docs/open-questions.md).
 */
export const SaleCreateSchema = z.object({
  clientId: cuidFk,
  serviceId: cuidFk,
  price: z.coerce.number().nonnegative(),
  date: z.coerce.date(),
  notes: z.string().max(10_000).optional().nullable(),
});

export const SaleUpdateSchema = SaleCreateSchema.partial();

/**
 * Read schema for API responses: Prisma Decimal serializes to a string
 * ("1500.50") and dates arrive as ISO strings — both coerced here.
 */
export const SaleReadSchema = z.object({
  id: z.string().uuid(),
  nominationId: z.string().uuid(),
  clientId: z.string(),
  serviceId: z.string(),
  price: z.coerce.number(),
  date: z.coerce.date(),
  notes: z.string().nullable().optional(),
  client: z.object({ id: z.string(), name: z.string() }),
  service: z.object({ id: z.string(), name: z.string() }),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type SaleCreate = z.infer<typeof SaleCreateSchema>;
export type SaleUpdate = z.infer<typeof SaleUpdateSchema>;
export type SaleRead = z.infer<typeof SaleReadSchema>;
