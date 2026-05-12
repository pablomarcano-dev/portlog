import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

const ContactBaseSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().toLowerCase().optional(),
  homePhone: z.string().min(1).max(50).optional(),
  mobile: z.string().min(1).max(50).optional(),
  businessPhone: z.string().min(1).max(50).optional(),
  businessFax: z.string().min(1).max(50).optional(),
  address: z.string().min(1).max(500).optional(),
  shipperId: z.string().cuid().optional(),
  operatorId: z.string().cuid().optional(),
  ownerId: z.string().cuid().optional(),
  charterId: z.string().cuid().optional(),
  comments: z.string().max(10_000).optional(),
});

// Enforce the DB CHECK constraint at the application layer (defense in depth):
// at most one of shipperId / operatorId / ownerId / charterId may be non-null.
const singleOwnerRefinement = (
  data: {
    shipperId?: string;
    operatorId?: string;
    ownerId?: string;
    charterId?: string;
  },
  ctx: z.RefinementCtx,
) => {
  const provided = [data.shipperId, data.operatorId, data.ownerId, data.charterId].filter(Boolean);

  if (provided.length > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At most one of shipperId, operatorId, ownerId, charterId may be provided.',
    });
  }
};

export const ContactCreateSchema = ContactBaseSchema.superRefine(singleOwnerRefinement);

export const ContactUpdateSchema = ContactBaseSchema.partial().superRefine(singleOwnerRefinement);

export const ContactListQuerySchema = ListQuerySchema;

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>;
