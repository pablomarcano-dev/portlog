import { z } from 'zod';
import { emailList, optionalText } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

// location: "L" = local, "E" = exterior — enforced at app layer per Prisma schema comment
export const OperatorCreateSchema = z.object({
  name: z.string().min(1).max(120),
  emails: emailList(),
  businessPhone: optionalText(50),
  businessFax: optionalText(50),
  address: optionalText(500),
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
