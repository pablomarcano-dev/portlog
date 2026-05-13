import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ContactCreateInput, ContactUpdateInput, ContactListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ContactRecord {
  id: string;
  name: string;
  email?: string | null;
  homePhone?: string | null;
  mobile?: string | null;
  businessPhone?: string | null;
  businessFax?: string | null;
  address?: string | null;
  shipperId?: string | null;
  operatorId?: string | null;
  ownerId?: string | null;
  charterId?: string | null;
  comments?: string | null;
}

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
    if (query?.shipperId) params.set('shipperId', query.shipperId);
    if (query?.operatorId) params.set('operatorId', query.operatorId);
    if (query?.ownerId) params.set('ownerId', query.ownerId);
    if (query?.charterId) params.set('charterId', query.charterId);
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
      void qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contactsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}
