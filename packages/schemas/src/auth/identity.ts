import { z } from 'zod';

/** Usernames have a namespace separate from legacy email login identifiers. */
export const UsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(64, 'Username must be at most 64 characters')
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Use letters, numbers, dots, underscores or hyphens');

export const OptionalUsernameSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  UsernameSchema.nullish(),
);

/** The email field remains accepted on the wire so existing clients still work. */
export const LoginIdentifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.union([z.string().email().max(254), UsernameSchema]));
