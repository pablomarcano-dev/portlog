import { z } from 'zod';

export const UserOperationalRoleSchema = z.enum(['BRANCH_MANAGER', 'SUPERVISOR', 'SHIPPING_AGENT']);

export const AdminUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  jobTitle: z.string().nullable(),
  phone: z.string().nullable(),
  mobile: z.string().nullable(),
  fax: z.string().nullable(),
  role: z.enum(['OPS', 'ADM']),
  operationalRole: UserOperationalRoleSchema.nullable(),
  isActive: z.boolean(),
  permissions: z.array(z.string()),
  // Default Sucursal — pre-fills the service-request forms.
  branchId: z.string().nullable(),
  branch: z.object({ id: z.string(), name: z.string(), code: z.string() }).nullable(),
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
  operationalRole: UserOperationalRoleSchema.nullable().optional(),
  branchId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().cuid().nullish(),
  ),
});
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  displayName: z.string().optional(),
  // Renders as the title line of the email signature.
  jobTitle: z.string().optional(),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  fax: z.string().optional(),
  role: z.enum(['OPS', 'ADM']).optional(),
  operationalRole: UserOperationalRoleSchema.nullable().optional(),
  isActive: z.boolean().optional(),
  // Blank clears the assignment; Prisma writes NULL.
  branchId: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().cuid().nullish(),
  ),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const ResetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;
