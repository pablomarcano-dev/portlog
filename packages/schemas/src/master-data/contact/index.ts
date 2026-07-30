import { z } from 'zod';
import { emailList, optionalText, optionalCuid, clearableCuid } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

const ContactBaseSchema = z.object({
  name: z.string().min(1).max(120),
  emails: emailList(),
  homePhone: optionalText(50),
  mobile: optionalText(50),
  businessPhone: optionalText(50),
  businessFax: optionalText(50),
  address: optionalText(500),
  // Clearable: switching the "Link to" category must be able to unset the old FK.
  shipperId: clearableCuid(),
  operatorId: clearableCuid(),
  ownerId: clearableCuid(),
  charterId: clearableCuid(),
  comments: z.string().max(10_000).optional(),
});

// Enforce the DB CHECK constraint at the application layer (defense in depth):
// at most one of shipperId / operatorId / ownerId / charterId may be non-null.
const singleOwnerRefinement = (
  data: {
    shipperId?: string | null;
    operatorId?: string | null;
    ownerId?: string | null;
    charterId?: string | null;
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

/**
 * Which entity a contact is cross-linked to. Filtering by role means "any contact
 * attached to some shipper/operator/owner/charterer" — as opposed to the
 * shipperId/operatorId/... filters, which target one specific entity.
 */
export const ContactRoleSchema = z.enum(['SHIPPER', 'OPERATOR', 'OWNER', 'CHARTERER']);

export const ContactListQuerySchema = ListQuerySchema.extend({
  role: ContactRoleSchema.optional(),
  shipperId: optionalCuid(),
  operatorId: optionalCuid(),
  ownerId: optionalCuid(),
  charterId: optionalCuid(),
});

export type ContactRole = z.infer<typeof ContactRoleSchema>;
export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>;
