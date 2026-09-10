import { z } from 'zod';

export const nullableText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() || null : v),
    z.string().max(max).nullish(),
  );
export const PhoneKindSchema = z.enum(['BUSINESS', 'HOME', 'MOBILE', 'FAX', 'OTHER']);
export const AddressPurposeSchema = z.enum(['PHYSICAL', 'BILLING', 'POSTAL', 'TAX', 'OTHER']);
export const PhoneEntrySchema = z
  .object({
    kind: PhoneKindSchema,
    number: z.string().trim().min(1).max(100),
    label: nullableText(100),
    sortOrder: z.number().int().nonnegative().default(0),
  })
  .strict();
export const AddressEntrySchema = z
  .object({
    purpose: AddressPurposeSchema,
    text: z.string().trim().min(1).max(2000),
    label: nullableText(100),
    sortOrder: z.number().int().nonnegative().default(0),
  })
  .strict();
export const AddressListSchema = z
  .array(AddressEntrySchema)
  .max(30)
  .superRefine((rows, ctx) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      const key = row.purpose === 'OTHER' ? `OTHER:${row.label?.toLowerCase() ?? ''}` : row.purpose;
      if (row.purpose === 'OTHER' && !row.label)
        ctx.addIssue({ code: 'custom', path: [index, 'label'], message: 'Label other addresses.' });
      if (seen.has(key))
        ctx.addIssue({
          code: 'custom',
          path: [index, 'purpose'],
          message: 'This address purpose or label is already used.',
        });
      seen.add(key);
    });
  });
export type PhoneEntry = z.infer<typeof PhoneEntrySchema>;
export type AddressEntry = z.infer<typeof AddressEntrySchema>;
export function formatPhones(phones: readonly PhoneEntry[]): string {
  return [...phones]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((p) => `${p.label || p.kind.toLowerCase()}: ${p.number}`)
    .join(' / ');
}
export function addressFor(
  addresses: readonly AddressEntry[],
  ...purposes: AddressEntry['purpose'][]
): string | null {
  for (const purpose of purposes) {
    const address = addresses.find((a) => a.purpose === purpose);
    if (address) return address.text;
  }
  return null;
}
