import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../client';
import {
  AdminUserListSchema,
  type AdminUser,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
} from '@portlog/schemas';

const QUERY_KEY = ['admin', 'users'] as const;

async function fetchUsers(): Promise<AdminUser[]> {
  const raw = await apiRequest<unknown>('/admin/users');
  return AdminUserListSchema.parse(raw).items;
}

export function useAdminUsers() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: fetchUsers });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) =>
      apiRequest<unknown>('/admin/users', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateUser(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateUserInput) =>
      apiRequest<unknown>(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<void>(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useResetPassword(id: string) {
  return useMutation({
    mutationFn: (data: ResetPasswordInput) =>
      apiRequest<void>(`/admin/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: data.newPassword }),
      }),
  });
}

export function useSendCredentials() {
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/admin/users/${id}/send-credentials`, { method: 'POST' }),
  });
}
