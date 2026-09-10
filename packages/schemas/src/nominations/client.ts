import { z } from 'zod';
export const NOMINATION_CLIENT_DIRECTORY_ID_FIELDS = ['clientId', 'ownerId'] as const;
export type NominationClientDirectoryIdField =
  (typeof NOMINATION_CLIENT_DIRECTORY_ID_FIELDS)[number];
type LinkData = { type?: string; clientId?: string | null; ownerId?: string | null };
export class NominationClientDirectoryLinkError extends Error {}
export function normalizeNominationClientDirectoryLinks<T extends LinkData>(
  input: T,
  existing?: LinkData,
): T {
  if (input.clientId && input.ownerId)
    throw new NominationClientDirectoryLinkError('Select one linked company.');
  const result = { ...input };
  if (input.clientId) result.ownerId = null;
  if (input.ownerId) result.clientId = null;
  const merged = { ...existing, ...result };
  if (merged.clientId && merged.ownerId)
    throw new NominationClientDirectoryLinkError('Select one linked company.');
  return result;
}
const singleCompatibleDirectoryLink = (data: LinkData, ctx: z.RefinementCtx) => {
  if (data.clientId && data.ownerId)
    ctx.addIssue({ code: 'custom', message: 'Select one linked company.' });
};
// ---------------------------------------------------------------------------
// NominationClient — single row in the CLIENT LIST table on a nomination
// Represents Type / Name / Voy / Ref No / Broker entries from the legacy UI.
// ---------------------------------------------------------------------------

export const NominationClientSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().max(100),
  name: z.string().max(200),
  // Set when the row's name was picked from its matching master-data directory.
  // `name` remains present for historical/manual entries and stable document text.
  clientId: z.string().cuid().optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
  voyageRef: z.string().max(50).optional().nullable(),
  referenceNo: z.string().max(100).optional().nullable(),
  proforma: z.string().max(200).optional().nullable(),
  broker: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const NominationClientCreateSchema = NominationClientSchema.omit({ id: true })
  .strict()
  .superRefine(singleCompatibleDirectoryLink);
export const NominationClientUpdateSchema = NominationClientSchema.omit({ id: true })
  .partial()
  .strict()
  .superRefine(singleCompatibleDirectoryLink);

export type NominationClientCreate = z.infer<typeof NominationClientCreateSchema>;
export type NominationClientUpdate = z.infer<typeof NominationClientUpdateSchema>;
export type NominationClient = z.infer<typeof NominationClientSchema>;
