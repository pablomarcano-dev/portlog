import { z } from 'zod';
import { emailList, optionalText, optionalCuid } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

const ContactBaseSchema = z.object({
  name: z.string().min(1).max(120),
  emails: emailList(),
  homePhone: optionalText(50),
  mobile: optionalText(50),
  businessPhone: optionalText(50),
  businessFax: optionalText(50),
  address: optionalText(500),
  shipperId: optionalCuid(),
  operatorId: optionalCuid(),
  ownerId: optionalCuid(),
  charterId: optionalCuid(),
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

export const ContactListQuerySchema = ListQuerySchema.extend({
  shipperId: optionalCuid(),
  operatorId: optionalCuid(),
  ownerId: optionalCuid(),
  charterId: optionalCuid(),
});

export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>;
