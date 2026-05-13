import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import {
  EmailGroupListResponseSchema,
  EmailGroupSchema,
  type EmailGroupCreateInput,
  type EmailGroupUpdateInput,
  type EmailGroupListQuery,
  type EmailGroupListResponse,
  type EmailGroup,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const emailGroupsApi = {
  list: async (q: Partial<EmailGroupListQuery> = {}): Promise<EmailGroupListResponse> => {
    const params = new URLSearchParams();
    if (q.search) params.set('search', q.search);
    if (q.page) params.set('page', String(q.page));
    if (q.pageSize) params.set('pageSize', String(q.pageSize));
    const qs = params.toString();
    const raw = await apiRequest<unknown>(`/master-data/email-groups${qs ? `?${qs}` : ''}`);
    return EmailGroupListResponseSchema.parse(raw);
  },

  get: async (id: string): Promise<EmailGroup> => {
    const raw = await apiRequest<unknown>(`/master-data/email-groups/${id}`);
    return EmailGroupSchema.parse(raw);
  },

  create: async (data: EmailGroupCreateInput): Promise<EmailGroup> => {
    const raw = await apiRequest<unknown>('/master-data/email-groups', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return EmailGroupSchema.parse(raw);
  },

  update: async (id: string, data: EmailGroupUpdateInput): Promise<EmailGroup> => {
    const raw = await apiRequest<unknown>(`/master-data/email-groups/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return EmailGroupSchema.parse(raw);
  },

  delete: async (id: string): Promise<void> => {
    await apiRequest<void>(`/master-data/email-groups/${id}`, { method: 'DELETE' });
  },
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const emailGroupsQueryOptions = (q: Partial<EmailGroupListQuery> = {}) =>
  queryOptions({
    queryKey: ['email-groups', 'list', q],
    queryFn: () => emailGroupsApi.list(q),
    staleTime: 30_000,
  });

export const emailGroupQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['email-groups', id],
    queryFn: () => emailGroupsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useEmailGroups(q: Partial<EmailGroupListQuery> = {}) {
  return useQuery(emailGroupsQueryOptions(q));
}

export function useEmailGroup(id: string) {
  return useQuery(emailGroupQueryOptions(id));
}

export function useSaveEmailGroup(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: EmailGroupCreateInput) => {
      if (selectedId !== null) {
        return emailGroupsApi.update(selectedId, values);
      }
      return emailGroupsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['email-groups'] });
    },
  });
}

export function useDeleteEmailGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => emailGroupsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['email-groups'] });
    },
  });
}
