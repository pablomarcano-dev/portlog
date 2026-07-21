import { z } from 'zod';

// ---------------------------------------------------------------------------
// Email attachments — shared constraints & schemas
// ---------------------------------------------------------------------------
// Used by both the browser (client-side pre-validation) and the backend
// (authoritative validation on upload + at send time). The SMTP relay
// (mail.navieramar.com) accepts attachments; these caps keep total message
// size within the range typical relays allow (~25 MB).
// ---------------------------------------------------------------------------

/** Max size of a single uploaded attachment. */
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

/** Max combined size of all attachments on one email. */
export const MAX_TOTAL_ATTACHMENTS_BYTES = 25 * 1024 * 1024; // 25 MB

/** Max number of attachments on one email. */
export const MAX_ATTACHMENTS_PER_EMAIL = 10;

/** MIME types accepted for upload. Everything else is rejected. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/tiff',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
] as const;

export type AllowedAttachmentMimeType = (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number];

export function isAllowedAttachmentMimeType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Reference to a stored attachment object (mirrors the EmailAttachment row and
 * the underlying MinIO object). This is the persisted/audit shape.
 */
export const attachmentRefSchema = z.object({
  minioKey: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
});
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

/** Response body from POST /api/attachments (a single uploaded file). */
export const attachmentUploadResponseSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string(),
});
export type AttachmentUploadResponse = z.infer<typeof attachmentUploadResponseSchema>;

/**
 * The field mixed into every "send email" schema: the IDs of previously
 * uploaded EmailAttachment rows to attach. Optional (not defaulted) so the
 * inferred output type stays `string[] | undefined` — existing callers that
 * omit it keep compiling, and every backend send site reads it as `?? []`.
 */
export const attachmentIdsSchema = z
  .array(z.string())
  .max(MAX_ATTACHMENTS_PER_EMAIL, `At most ${MAX_ATTACHMENTS_PER_EMAIL} attachments per email`)
  .optional();
