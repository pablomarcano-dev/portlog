import { z } from 'zod';

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  fax: z.string().nullable(),
  role: z.enum(['OPS', 'ADM']),
  isActive: z.boolean(),
  permissions: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

export const AdminUserListSchema = z.object({
  items: z.array(AdminUserSchema),
});
export type AdminUserList = z.infer<typeof AdminUserListSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email('Valid email required'),
  displayName: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['OPS', 'ADM']),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  displayName: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  role: z.enum(['OPS', 'ADM']).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
