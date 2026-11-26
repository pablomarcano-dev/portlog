import { z } from 'zod';
import { UserOperationalRoleSchema } from '../common/operational-positions';
import { LoginIdentifierSchema } from './identity.js';
export * from './identity.js';

export const RoleSchema = z.enum(['OPS', 'ADM', 'FLT']);
export type Role = z.infer<typeof RoleSchema>;

/** Operational titles never imply access. These roles are assigned explicitly by Admin. */
export function hasManagementAccess(user: { role: Role } | null | undefined): boolean {
  return user?.role === 'ADM' || user?.role === 'FLT';
}

export const LoginRequestSchema = z.object({
  email: LoginIdentifierSchema,
  password: z.string().min(8).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CurrentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().nullable().optional(),
  role: RoleSchema,
  operationalRole: UserOperationalRoleSchema.nullable().default(null),
  isActive: z.boolean(),
  twoFactorEnabled: z.boolean().default(false),
  permissions: z.array(z.string()).default([]),
  /**
   * The user's default Sucursal. Service-request forms pre-fill from this
   * ("Sucursal: carga según el usuario") but leave the field editable.
   * Null for accounts that predate the column or have not been assigned one.
   */
  branchId: z.string().nullable().default(null),
  branchCode: z.string().nullable().default(null),
  primaryBranchId: z.string().nullable().optional(),
  branches: z.array(z.object({ id: z.string(), name: z.string(), code: z.string() })).optional(),
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  user: CurrentUserSchema,
});
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

export const EmailCodeChallengeSchema = z.object({
  twoFactorRequired: z.literal(true),
  challengeId: z.string().regex(/^[a-f0-9]{64}$/),
  maskedEmail: z.string(),
  expiresAt: z.string().datetime(),
});
export type EmailCodeChallenge = z.infer<typeof EmailCodeChallengeSchema>;
export const LoginOutcomeSchema = z.union([LoginResponseSchema, EmailCodeChallengeSchema]);
export const VerifyEmailCodeSchema = z
  .object({
    challengeId: z.string().regex(/^[a-f0-9]{64}$/),
    code: z.string().regex(/^\d{6}$/, 'Enter the six-digit code.'),
  })
  .strict();
export type VerifyEmailCode = z.infer<typeof VerifyEmailCodeSchema>;
export const TwoFactorChangeSchema = z
  .object({
    enabled: z.boolean(),
    password: z.string().min(8).max(256),
  })
  .strict();
