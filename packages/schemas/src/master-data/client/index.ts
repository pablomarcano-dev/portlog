import { z } from 'zod';
import { emailList } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';
import { PhoneEntrySchema, AddressListSchema, nullableText } from '../communication';

export const ClientEntityTypeSchema = z.enum(['CLIENT', 'CHARTERER', 'SHIPPER', 'OPERATOR']);
export const ClientEmailSlotSchema = z.enum([
  'FIRST_MESSAGE',
  'SECOND_MESSAGE',
  'THIRD_MESSAGE',
  'CC_MESSAGE',
]);
export const CLIENT_EMAIL_SLOT_LABELS = {
  FIRST_MESSAGE: '1st Message',
  SECOND_MESSAGE: '2nd Message',
  THIRD_MESSAGE: '3rd Message',
  CC_MESSAGE: 'CC Message',
} as const;
export const ClientEmailAssignmentSchema = z
  .object({ slot: ClientEmailSlotSchema, emailGroupId: z.string().cuid() })
  .strict();
export const ClientEmailAssignmentsSchema = z
  .array(ClientEmailAssignmentSchema)
  .max(4)
  .refine(
    (rows) => new Set(rows.map((r) => r.slot)).size === rows.length,
    'Each message slot may be assigned once.',
  );
export const ClientTariffItemSchema = z
  .object({
    item: z.string().trim().min(1).max(300),
    amountText: nullableText(200),
    information: nullableText(2000),
    sortOrder: z.number().int().nonnegative().default(0),
  })
  .strict();
export const ClientCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    entityType: ClientEntityTypeSchema.default('CLIENT'),
    emails: emailList(),
    phones: z.array(PhoneEntrySchema).max(30).default([]),
    addresses: AddressListSchema.default([]),
    instructions: nullableText(100_000),
    notes: nullableText(10_000),
    locationType: z.enum(['LOCAL', 'EXTERIOR']).nullish(),
    contactIds: z
      .array(z.string().cuid())
      .max(200)
      .refine((v) => new Set(v).size === v.length, 'Duplicate contacts.')
      .default([]),
    tariffItems: z.array(ClientTariffItemSchema).max(200).default([]),
    emailGroups: ClientEmailAssignmentsSchema.default([]),
  })
  .strict();
export const ClientUpdateSchema = ClientCreateSchema.partial();
export const ClientListQuerySchema = ListQuerySchema.extend({
  entityType: ClientEntityTypeSchema.optional(),
});
export type ClientCreateInput = z.infer<typeof ClientCreateSchema>;
export type ClientUpdateInput = z.infer<typeof ClientUpdateSchema>;
export type ClientListQuery = z.infer<typeof ClientListQuerySchema>;
export type ClientEntityType = z.infer<typeof ClientEntityTypeSchema>;
export type ClientEmailSlot = z.infer<typeof ClientEmailSlotSchema>;
export const CompanyContactSchema = z.object({
  id: z.string(),
  name: z.string(),
  emails: z.array(z.string()),
  phones: z.array(PhoneEntrySchema),
  addresses: AddressListSchema,
});
export const ClientReadSchema = ClientCreateSchema.omit({
  contactIds: true,
  emailGroups: true,
}).extend({
  id: z.string().cuid(),
  emails: z.array(z.string().email()),
  contacts: z.array(CompanyContactSchema),
  emailGroups: z.array(
    ClientEmailAssignmentSchema.extend({
      emailGroup: z.object({
        id: z.string(),
        name: z.string(),
        members: z.array(
          z.object({
            id: z.string(),
            email: z.string(),
            displayName: z.string().nullable(),
            order: z.number(),
          }),
        ),
      }),
    }),
  ),
  label: z.string().optional(),
});
export type ClientRecord = z.infer<typeof ClientReadSchema>;
