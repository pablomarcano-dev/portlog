import { NominationCreateSchema, type NominationCreateInput } from '@portlog/schemas';

const prefix = 'portlog:pending-nomination:v1:';
const dateKeys = ['dateNominated', 'layDaysFirst', 'layDaysLast', 'etaDate'];
const allowed = new Set(Object.keys(NominationCreateSchema.innerType().shape));
export function draftKey(userId: string) {
  return prefix + userId;
}
export function readNominationDraft(
  storage: Pick<Storage, 'getItem'>,
  userId: string,
): Partial<NominationCreateInput> | null {
  try {
    const raw = storage.getItem(draftKey(userId));
    if (!raw || raw.length > 2_000_000) return null;
    const data = JSON.parse(raw) as {
      version?: number;
      owner?: string;
      values?: Record<string, unknown>;
    };
    if (
      data.version !== 1 ||
      data.owner !== userId ||
      !data.values ||
      typeof data.values !== 'object' ||
      Array.isArray(data.values)
    )
      return null;
    const values = Object.fromEntries(
      Object.entries(data.values).filter(([key]) => allowed.has(key)),
    );
    for (const [key, value] of Object.entries(values)) {
      if (
        ['parcels', 'nominationClients', 'emailTo', 'emailCc', 'emailBcc'].includes(key) &&
        !Array.isArray(value)
      )
        return null;
      if (!Array.isArray(value) && value !== null && typeof value === 'object') return null;
    }
    for (const key of ['parcels', 'nominationClients'])
      if (
        Array.isArray(values[key]) &&
        !(values[key] as unknown[]).every(
          (item) => item && typeof item === 'object' && !Array.isArray(item),
        )
      )
        return null;
    for (const key of dateKeys)
      if (typeof values[key] === 'string') {
        const date = new Date(values[key] as string);
        if (!Number.isFinite(date.getTime())) return null;
        values[key] = date;
      }
    // Preserve incomplete input; normal form validation still runs at Create.
    return values as Partial<NominationCreateInput>;
  } catch {
    return null;
  }
}
export function saveNominationDraft(
  storage: Pick<Storage, 'setItem'>,
  userId: string,
  values: Partial<NominationCreateInput>,
) {
  storage.setItem(
    draftKey(userId),
    JSON.stringify({ version: 1, owner: userId, savedAt: new Date().toISOString(), values }),
  );
}
export function clearNominationDraft(storage: Pick<Storage, 'removeItem'>, userId: string) {
  storage.removeItem(draftKey(userId));
}
