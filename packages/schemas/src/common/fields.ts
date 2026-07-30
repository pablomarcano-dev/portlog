import { z } from 'zod';

/**
 * Shared field builders for master-data schemas.
 *
 * Background (POR / `nuevo sysportlog.pdf`, 22 Jul 2026): every optional text field used to be
 * declared as `z.string().min(1).max(N).optional()`. `.optional()` only permits `undefined`, but
 * React Hook Form submits `""` for an untouched text input — so `min(1)` fired and the form
 * reported `String must contain at least 1 character(s)` on fields that were never required.
 * That blocked saving an Owner, which in turn blocked creating a nomination.
 */

/** Treat an empty / whitespace-only string as "not provided". */
const emptyToUndefined = (v: unknown): unknown =>
  typeof v === 'string' && v.trim() === '' ? undefined : v;

/**
 * An optional free-text field. Blank input is normalised to `undefined` rather than failing
 * validation. Use this instead of `z.string().min(1).max(n).optional()`.
 */
export const optionalText = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

/**
 * Wrap any string schema so that blank input means "not provided" instead of a format error.
 * Without this, a cleared `.url()` / `.cuid()` field reports "Invalid url" on an empty box.
 */
export const optionalBlank = <T extends z.ZodTypeAny>(inner: T) =>
  z.preprocess(emptyToUndefined, inner.optional());

/** An optional URL field that tolerates being left blank. */
export const optionalUrl = () => optionalBlank(z.string().trim().url());

/** An optional cuid foreign key that tolerates a cleared picker sending `""`. */
export const optionalCuid = () => optionalBlank(z.string().cuid());

/**
 * A cuid foreign key that can be explicitly cleared.
 *
 * `optionalCuid()` normalises a cleared picker to `undefined`, which `JSON.stringify`
 * strips from the request body — so a PATCH can never unset the column, and the old
 * link silently survives the save. Blank input becomes `null` here, which Prisma
 * writes as NULL. Use this for any FK the user is allowed to unset.
 */
export const clearableCuid = () =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().cuid().nullish(),
  );

// ---------------------------------------------------------------------------
// Email lists
// ---------------------------------------------------------------------------

/** Chunk separators. Whitespace is deliberately excluded here — see `parseEmailList`. */
const CHUNK_SEPARATORS = /[,;\r\n]+/;

/** `Franklin Graterol <fg@example.com>` → `fg@example.com` */
const ANGLE_BRACKET_ADDRESS = /<\s*([^>\s]+)\s*>/;

/**
 * Pull individual addresses out of arbitrary pasted text.
 *
 * Tolerates the shapes people actually paste out of Outlook: comma-, semicolon- or
 * newline-separated, space-separated, and `Display Name <addr@host>`. Lowercases and de-duplicates.
 *
 * Splitting happens in two passes on purpose. Whitespace is *not* a top-level separator, because
 * `Franklin Graterol <fg@example.com>` would then shred into "franklin", "graterol" and the
 * address. Chunks are cut on punctuation first; only a chunk that holds several `@` tokens is
 * split further on whitespace.
 *
 * Does NOT validate — a chunk that is plainly not an address is still returned, so callers can
 * report exactly what was rejected instead of dropping it silently.
 */
export function parseEmailList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (value: string): void => {
    const address = value
      .trim()
      .replace(/^["'<]+|[>"',;]+$/g, '')
      .toLowerCase();
    if (!address || seen.has(address)) return;
    seen.add(address);
    out.push(address);
  };

  for (const chunk of raw.split(CHUNK_SEPARATORS)) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const bracketed = ANGLE_BRACKET_ADDRESS.exec(trimmed);
    if (bracketed?.[1]) {
      push(bracketed[1]);
      continue;
    }

    const tokens = trimmed.split(/\s+/).filter(Boolean);
    const addressTokens = tokens.filter((t) => t.includes('@'));
    if (tokens.length > 1 && addressTokens.length > 0) {
      // "a@x.com b@x.com" — space-separated addresses with no display names.
      addressTokens.forEach(push);
    } else {
      // Single token, or free text with no address in it: hand it back for the caller to reject.
      push(trimmed);
    }
  }

  return out;
}

/**
 * Zod field for "one or more email addresses", stored as a `String[]` column.
 *
 * Accepts an array (the normal client shape) or a raw string, so a caller that still sends a
 * single address — or a comma-separated blob — keeps working.
 *
 * Optional rather than `.default([])` on purpose: an absent field means "leave unchanged" on
 * update and "fall back to the column default" on create, and it keeps callers that build partial
 * payloads from having to pass an empty array. Clearing every chip sends `[]`, which does clear it.
 */
export const emailList = () =>
  z.preprocess((v) => {
    if (v === null || v === undefined) return undefined;
    if (typeof v === 'string') return parseEmailList(v);
    if (Array.isArray(v)) {
      return v.flatMap((entry) => (typeof entry === 'string' ? parseEmailList(entry) : entry));
    }
    return v;
  }, z.array(z.string().email()).optional());
