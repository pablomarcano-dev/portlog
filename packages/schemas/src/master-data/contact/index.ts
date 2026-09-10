import { z } from 'zod';
import { clearableCuid, optionalCuid, emailList } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';
import { PhoneEntrySchema, AddressListSchema, nullableText } from '../communication';
import { ClientEntityTypeSchema } from '../client';
export const ContactCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    emails: emailList(),
    phones: z.array(PhoneEntrySchema).max(30).default([]),
    addresses: AddressListSchema.default([]),
    notes: nullableText(10_000),
    ownerId: clearableCuid(),
    clientIds: z
      .array(z.string().cuid())
      .max(200)
      .refine((v) => new Set(v).size === v.length, 'Duplicate clients.')
      .default([]),
  })
  .strict();
export const ContactUpdateSchema = ContactCreateSchema.partial();
export const ContactListQuerySchema = ListQuerySchema.extend({
  clientId: optionalCuid(),
  entityType: ClientEntityTypeSchema.optional(),
  ownerId: optionalCuid(),
});
export const ContactReadSchema = ContactCreateSchema.omit({ clientIds: true }).extend({
  id: z.string().cuid(),
  emails: z.array(z.string().email()),
  clients: z.array(
    z.object({ id: z.string(), name: z.string(), entityType: ClientEntityTypeSchema }),
  ),
  label: z.string().optional(),
});
export type ContactCreateInput = z.infer<typeof ContactCreateSchema>;
export type ContactUpdateInput = z.infer<typeof ContactUpdateSchema>;
export type ContactListQuery = z.infer<typeof ContactListQuerySchema>;
export type ContactRecord = z.infer<typeof ContactReadSchema>;
