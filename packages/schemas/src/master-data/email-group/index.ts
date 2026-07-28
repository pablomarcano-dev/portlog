import { z } from 'zod';

export const EmailGroupMemberSchema = z.object({
  email: z.string().email(),
  displayName: z.string().max(255).optional(),
  order: z.number().int().default(0),
});

export const EmailGroupCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(500).optional(),
  comments: z.string().optional(),
  // The UI's "+ Add row" button seeds a member with an empty email. Validating that as an address
  // failed the whole form, and because the shell had no invalid-submit feedback the Accept button
  // simply did nothing ("tampoco se guardan" — `nuevo sysportlog.pdf`, 22 Jul 2026). Blank rows are
  // dropped here so an unfilled row can never block a save.
  members: z.preprocess(
    (v) =>
      Array.isArray(v)
        ? v.filter((m) => {
            const email = (m as { email?: unknown } | null)?.email;
            return typeof email !== 'string' || email.trim() !== '';
          })
        : v,
    z.array(EmailGroupMemberSchema).default([]),
  ),
});

export const EmailGroupUpdateSchema = EmailGroupCreateSchema.partial();

export const EmailGroupListQuerySchema = z.object({
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

export const EmailGroupListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  memberCount: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const EmailGroupSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  comments: z.string().nullable(),
  members: z.array(EmailGroupMemberSchema.extend({ id: z.string() })),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const EmailGroupListResponseSchema = z.object({
  items: z.array(EmailGroupListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

export type EmailGroupMember = z.infer<typeof EmailGroupMemberSchema>;
export type EmailGroupCreateInput = z.infer<typeof EmailGroupCreateSchema>;
export type EmailGroupUpdateInput = z.infer<typeof EmailGroupUpdateSchema>;
export type EmailGroupListQuery = z.infer<typeof EmailGroupListQuerySchema>;
export type EmailGroupListItem = z.infer<typeof EmailGroupListItemSchema>;
export type EmailGroup = z.infer<typeof EmailGroupSchema>;
export type EmailGroupListResponse = z.infer<typeof EmailGroupListResponseSchema>;
