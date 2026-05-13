import { z } from 'zod';

export const RoleSchema = z.enum(['OPS', 'ADM']);
export type Role = z.infer<typeof RoleSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(256),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const CurrentUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: RoleSchema,
  isActive: z.boolean(),
  permissions: z.array(z.string()).default([]),
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
