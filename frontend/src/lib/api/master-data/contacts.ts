import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ContactCreateInput, ContactUpdateInput, ContactListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export type { ContactRecord } from '@portlog/schemas';
import type { ContactRecord } from '@portlog/schemas';

export interface ContactListResponse {
  items: (ContactRecord & { label: string })[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const contactsApi = {
  list: (query?: Partial<ContactListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    if (query?.clientId) params.set('clientId', query.clientId);
    if (query?.entityType) params.set('entityType', query.entityType);
    if (query?.ownerId) params.set('ownerId', query.ownerId);
    const qs = params.toString();
    return apiRequest<ContactListResponse>(`/master-data/contacts${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ContactRecord>(`/master-data/contacts/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/contacts/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ContactCreateInput) =>
    apiRequest<ContactRecord>('/master-data/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ContactUpdateInput) =>
    apiRequest<ContactRecord>(`/master-data/contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/contacts/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const contactsQueryOptions = (query?: Partial<ContactListQuery>) =>
  queryOptions({
    queryKey: ['contacts', 'list', query],
    queryFn: () => contactsApi.list(query),
    staleTime: 30_000,
  });

export const contactQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['contacts', id],
    queryFn: () => contactsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useContacts(query?: Partial<ContactListQuery>) {
  return useQuery(contactsQueryOptions(query));
}

export function useContact(id: string) {
  return useQuery(contactQueryOptions(id));
}

export function useSaveContact(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ContactCreateInput) => {
      if (selectedId !== null) {
        return contactsApi.update(selectedId, values);
      }
      return contactsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['contacts'] });
      void qc.invalidateQueries({ queryKey: ['nominations'] });
      void qc.invalidateQueries({ queryKey: ['nomination'] });
      void qc.invalidateQueries({ queryKey: ['entity-picker'] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['contacts'] });
      void qc.invalidateQueries({ queryKey: ['nominations'] });
      void qc.invalidateQueries({ queryKey: ['nomination'] });
      void qc.invalidateQueries({ queryKey: ['entity-picker'] });
    },
  });
}
