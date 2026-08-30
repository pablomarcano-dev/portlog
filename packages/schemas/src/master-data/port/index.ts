import { z } from 'zod';
import { emailList, optionalText } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

export const PortCreateSchema = z.object({
  name: z.string().min(1).max(120),
  abbreviation: z.string().max(20).optional(),
  country: optionalText(120),
  branchId: z.string().cuid('Select a valid branch'),
  // Addresses for the terminal itself, written to when a notice is addressed to
  // the terminal rather than to the nomination's client list.
  emails: emailList(),
  emailGroup: z.string().max(120).optional(),
  comments: z.string().max(10_000).optional(),
  terminalContacts: z
    .array(
      z.object({
        userId: z.string().cuid(),
        recipientType: z.enum(['TO', 'CC', 'BCC']).default('TO'),
      }),
    )
    .default([]),
});

export const PortUpdateSchema = PortCreateSchema.partial();

export const PortListQuerySchema = ListQuerySchema.extend({
  branchId: z.string().cuid().optional(),
});

export type PortCreateInput = z.infer<typeof PortCreateSchema>;
export type PortUpdateInput = z.infer<typeof PortUpdateSchema>;
export type PortListQuery = z.infer<typeof PortListQuerySchema>;
