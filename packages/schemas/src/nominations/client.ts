import { z } from 'zod';

export const NOMINATION_CLIENT_DIRECTORY_ID_FIELDS = [
  'chartererId',
  'ownerId',
  'operatorId',
  'shipperId',
] as const;

export type NominationClientDirectoryIdField =
  (typeof NOMINATION_CLIENT_DIRECTORY_ID_FIELDS)[number];

const DIRECTORY_FIELD_BY_CLIENT_TYPE: Record<string, NominationClientDirectoryIdField> = {
  charterer: 'chartererId',
  charters: 'chartererId',
  'time charter': 'chartererId',
  owner: 'ownerId',
  owners: 'ownerId',
  'disponent owner': 'ownerId',
  'head owner': 'ownerId',
  operator: 'operatorId',
  operators: 'operatorId',
  'commercial operator': 'operatorId',
  'commercial oper.': 'operatorId',
  'technical operator': 'operatorId',
  shipper: 'shipperId',
  shippers: 'shipperId',
};

type NominationClientDirectoryLinkData = Partial<
  Record<NominationClientDirectoryIdField, string | null>
> & {
  type?: string;
  [key: string]: unknown;
};

/** The one master-data directory a known Client List type belongs to. */
export function nominationClientDirectoryIdField(
  type: string | null | undefined,
): NominationClientDirectoryIdField | undefined {
  return type ? DIRECTORY_FIELD_BY_CLIENT_TYPE[type.trim().toLowerCase()] : undefined;
}

function populatedDirectoryFields(
  data: NominationClientDirectoryLinkData,
): NominationClientDirectoryIdField[] {
  return NOMINATION_CLIENT_DIRECTORY_ID_FIELDS.filter((field) => !!data[field]);
}

function directoryLinkIssue(data: NominationClientDirectoryLinkData): string | undefined {
  const populated = populatedDirectoryFields(data);
  if (populated.length > 1) {
    return 'At most one client directory reference may be provided.';
  }

  const expected = nominationClientDirectoryIdField(data.type);
  if (expected && populated.length === 1 && populated[0] !== expected) {
    return `Client type "${data.type?.trim()}" may only use ${expected}.`;
  }

  return undefined;
}

const singleCompatibleDirectoryLink = (
  data: NominationClientDirectoryLinkData,
  ctx: z.RefinementCtx,
) => {
  const message = directoryLinkIssue(data);
  if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
};

export class NominationClientDirectoryLinkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NominationClientDirectoryLinkError';
  }
}

/**
 * Normalizes a create or partial update before it reaches Prisma.
 *
 * Selecting a directory record clears every other directory FK. Changing a
 * known row type also clears links from the old directory. Unknown/manual row
 * types are intentionally left alone unless a new directory record is picked,
 * so unrelated edits do not rewrite legacy data.
 */
export function normalizeNominationClientDirectoryLinks<
  T extends NominationClientDirectoryLinkData,
>(input: T, existing?: NominationClientDirectoryLinkData): T {
  const populated = populatedDirectoryFields(input);
  if (populated.length > 1) {
    throw new NominationClientDirectoryLinkError(
      'At most one client directory reference may be provided.',
    );
  }

  const resolvedType = input.type ?? existing?.type;
  const expected = nominationClientDirectoryIdField(resolvedType);
  const selected = populated[0];
  if (expected && selected && selected !== expected) {
    throw new NominationClientDirectoryLinkError(
      `Client type "${resolvedType?.trim()}" may only use ${expected}.`,
    );
  }

  const normalized: NominationClientDirectoryLinkData = { ...input };
  if (selected) {
    for (const field of NOMINATION_CLIENT_DIRECTORY_ID_FIELDS) {
      if (field !== selected) normalized[field] = null;
    }
  } else if (input.type !== undefined && expected) {
    for (const field of NOMINATION_CLIENT_DIRECTORY_ID_FIELDS) {
      if (field !== expected) normalized[field] = null;
    }
  }

  return normalized as T;
}

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
  chartererId: z.string().cuid().optional().nullable(),
  ownerId: z.string().cuid().optional().nullable(),
  operatorId: z.string().cuid().optional().nullable(),
  shipperId: z.string().cuid().optional().nullable(),
  voyageRef: z.string().max(50).optional().nullable(),
  referenceNo: z.string().max(100).optional().nullable(),
  proforma: z.string().max(200).optional().nullable(),
  broker: z.string().max(200).optional().nullable(),
  sortOrder: z.number().int().default(0),
});

export const NominationClientCreateSchema = NominationClientSchema.omit({ id: true }).superRefine(
  singleCompatibleDirectoryLink,
);
export const NominationClientUpdateSchema = NominationClientSchema.omit({ id: true })
  .partial()
  .superRefine(singleCompatibleDirectoryLink);

export type NominationClientCreate = z.infer<typeof NominationClientCreateSchema>;
export type NominationClientUpdate = z.infer<typeof NominationClientUpdateSchema>;
export type NominationClient = z.infer<typeof NominationClientSchema>;
