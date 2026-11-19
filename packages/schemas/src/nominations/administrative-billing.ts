import { z } from 'zod';
import { AddressPurposeSchema } from '../master-data/communication.js';

export const AdministrativeBillingCategorySchema = z.enum([
  'PORT_COSTS',
  'OWNER_EXPENSES',
  'TECHNICAL_MANAGEMENT',
]);

const AdministrativeBillingAddressPurposeSchema = AddressPurposeSchema.extract(['TAX', 'BILLING']);

export const AdministrativeBillingSelectionSchema = z
  .object({
    clientId: z.string().cuid(),
    addressPurpose: AdministrativeBillingAddressPurposeSchema,
    addressText: z
      .string()
      .max(2000)
      .refine((text) => text.trim().length > 0),
  })
  .strict();

export const AdministrativeBillingUpdateSchema = z
  .object({ selection: AdministrativeBillingSelectionSchema.nullable() })
  .strict();

export type AdministrativeBillingCategory = z.infer<typeof AdministrativeBillingCategorySchema>;
export type AdministrativeBillingSelection = z.infer<typeof AdministrativeBillingSelectionSchema>;
export type AdministrativeBillingUpdate = z.infer<typeof AdministrativeBillingUpdateSchema>;
export type AdministrativeBillingRecipient = AdministrativeBillingSelection & {
  clientName: string;
};
export type AdministrativeBillingRecipients = Record<
  AdministrativeBillingCategory,
  AdministrativeBillingRecipient | null
>;
