import { z } from 'zod';

// ---------------------------------------------------------------------------
// Field builders with usable messages
// ---------------------------------------------------------------------------
// Zod's defaults ("Required", "Expected number, received nan", "Invalid date")
// are rendered verbatim under the input by `zodResolver`, and an operator
// filling a service request needs to be told what to do, not which type-check
// failed. Every field in this module goes through one of these.
//
// The coercion helpers exist because `z.coerce.number()` and `z.coerce.date()`
// coerce *before* validating: `Number(undefined)` is `NaN` and
// `new Date(undefined)` is an Invalid Date, so `required_error` is unreachable
// and an empty box reports a type error. These normalise "empty" to `undefined`
// first, which makes "you left it blank" and "you typed nonsense" two different
// messages again.
// ---------------------------------------------------------------------------

/** Is this what an untouched input submits? */
const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * A number the user must supply. Numeric strings from an `<input>` are
 * converted; anything genuinely non-numeric is passed through untouched so the
 * `invalid_type_error` fires instead of a silent `NaN`.
 */
export function requiredNumber(opts: { missing: string; notANumber: string }) {
  return z.preprocess(
    (v) => {
      if (isBlank(v)) return undefined;
      if (typeof v === 'string') {
        const parsed = Number(v);
        return Number.isNaN(parsed) ? v : parsed;
      }
      return v;
    },
    z.number({ required_error: opts.missing, invalid_type_error: opts.notANumber }),
  );
}

/** Same coercion, but a blank box is a legitimate "not known yet" → null. */
export function optionalNumber(opts: { notANumber: string; negative: string }) {
  return z.preprocess(
    (v) => {
      if (isBlank(v)) return null;
      if (typeof v === 'string') {
        const parsed = Number(v);
        return Number.isNaN(parsed) ? v : parsed;
      }
      return v;
    },
    z.number({ invalid_type_error: opts.notANumber }).nonnegative(opts.negative).nullable(),
  );
}

/**
 * A date the user must supply.
 *
 * A single `errorMap` rather than separate required/invalid messages: `z.date`
 * raises `invalid_date` for a malformed value and `invalid_type` for a missing
 * one, and for a date picker "Enter the scheduled date and time" is the right
 * instruction either way.
 */
export function requiredDate(message: string) {
  return z.preprocess(
    (v) => (isBlank(v) ? undefined : v instanceof Date ? v : new Date(v as string)),
    z.date({ errorMap: () => ({ message }) }),
  );
}

/** An optional date; blank means "has not happened yet". */
export function optionalDate(message: string) {
  return z.preprocess(
    (v) => (isBlank(v) ? null : v instanceof Date ? v : new Date(v as string)),
    z.date({ errorMap: () => ({ message }) }).nullable(),
  );
}

/** Optional free text; blank input is "not provided", not a validation error. */
export function optionalTextField(max: number, field: string) {
  return z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string({ invalid_type_error: `${field} must be text` })
      .trim()
      .max(max, `${field} must be ${max} characters or fewer`)
      .optional(),
  );
}

/** Required free text. */
export function requiredTextField(max: number, opts: { missing: string; tooLong?: string }) {
  return z
    .string({ required_error: opts.missing, invalid_type_error: opts.missing })
    .trim()
    .min(1, opts.missing)
    .max(max, opts.tooLong ?? `Must be ${max} characters or fewer`);
}

/** A required master-data reference. */
export function requiredRef(field: string) {
  return z
    .string({ required_error: `Select a ${field}`, invalid_type_error: `Select a ${field}` })
    .min(1, `Select a ${field}`)
    .cuid(`That ${field} reference is not valid`);
}

/**
 * An optional master-data reference the user is allowed to clear.
 *
 * Blank becomes `null`, not `undefined`: `JSON.stringify` strips `undefined`
 * from a PATCH body, so the column could never be unset and the old link would
 * silently survive the save. Same reasoning as `clearableCuid` in common/fields.
 */
export function clearableRef(field: string) {
  return z.preprocess(
    (v) => (isBlank(v) || (typeof v === 'string' && v.trim() === '') ? null : v),
    z.string().cuid(`That ${field} reference is not valid`).nullish(),
  );
}

/** A checkbox. Only reachable by a malformed API call, but named anyway. */
export function flag(field: string) {
  return z.boolean({ invalid_type_error: `${field} must be yes or no` }).default(false);
}
