import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// location: "L" = local, "E" = exterior — enforced at app layer per Prisma schema comment
export const OperatorCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().optional(),
  businessPhone: z.string().min(1).max(50).optional(),
  businessFax: z.string().min(1).max(50).optional(),
  address: z.string().min(1).max(500).optional(),
  standardRequirements: z.string().max(10_000).optional(),
  sendCopy: z.boolean().default(false),
  location: z.enum(['L', 'E']).optional(),
  itemsProforma: z.record(z.unknown()).optional(),
  comments: z.string().max(10_000).optional(),
});

export const OperatorUpdateSchema = OperatorCreateSchema.partial();

export const OperatorListQuerySchema = ListQuerySchema;

export type OperatorCreateInput = z.infer<typeof OperatorCreateSchema>;
export type OperatorUpdateInput = z.infer<typeof OperatorUpdateSchema>;
export type OperatorListQuery = z.infer<typeof OperatorListQuerySchema>;
