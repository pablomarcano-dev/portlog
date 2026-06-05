import { z } from 'zod';

// ---------------------------------------------------------------------------
// NominationMessageItem — unified view over email_dispatches (via PEDR) and
// sh_document_dispatches (direct nominationId FK). Used by
// GET /nominations/:id/messages.
// ---------------------------------------------------------------------------

export const NominationMessageSourceSchema = z.enum(['PEDR_DISPATCH', 'SH_DISPATCH']);
export type NominationMessageSource = z.infer<typeof NominationMessageSourceSchema>;

export const NominationMessageStatusSchema = z.enum(['SENT', 'FAILED', 'PENDING']);
export type NominationMessageStatus = z.infer<typeof NominationMessageStatusSchema>;

export const NominationMessageItemSchema = z.object({
  id: z.string(),
  source: NominationMessageSourceSchema,
  /** SubDocType (PEDR_DISPATCH) or SHDocumentType (SH_DISPATCH) */
  type: z.string(),
  subject: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  sentAt: z.string().nullable(),
  status: NominationMessageStatusSchema,
  error: z.string().nullable(),
  createdAt: z.string(),
  sentBy: z.object({ id: z.string(), email: z.string() }),
  bodyHtml: z.string().nullable(),
});
export type NominationMessageItem = z.infer<typeof NominationMessageItemSchema>;

export const NominationMessagesResponseSchema = z.object({
  items: z.array(NominationMessageItemSchema),
});
export type NominationMessagesResponse = z.infer<typeof NominationMessagesResponseSchema>;
