import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type {
  SalesContactCreateInput,
  SalesContactUpdateInput,
  SalesContactListQuery,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface SalesContactRecord {
  id: string;
  name: string;
  phone?: string | null;
  mobile?: string | null;
  documentNumber?: string | null;
  vehicle?: string | null;
  comments?: string | null;
  label: string;
}

export interface SalesContactListResponse {
  items: SalesContactRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const salesContactsApi = {
  list: (query?: Partial<SalesContactListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<SalesContactListResponse>(`/master-data/sales-contacts${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<SalesContactRecord>(`/master-data/sales-contacts/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/sales-contacts/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: SalesContactCreateInput) =>
    apiRequest<SalesContactRecord>('/master-data/sales-contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: SalesContactUpdateInput) =>
    apiRequest<SalesContactRecord>(`/master-data/sales-contacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/master-data/sales-contacts/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options (for prefetching and reuse)
// ---------------------------------------------------------------------------

export const salesContactsListQueryOptions = (query?: Partial<SalesContactListQuery>) =>
  queryOptions({
    queryKey: ['sales-contacts', 'list', query],
    queryFn: () => salesContactsApi.list(query),
    staleTime: 30_000,
  });

export const salesContactQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['sales-contacts', id],
    queryFn: () => salesContactsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useSalesContactsList(query?: Partial<SalesContactListQuery>) {
  return useQuery(salesContactsListQueryOptions(query));
}

export function useSalesContact(id: string) {
  return useQuery(salesContactQueryOptions(id));
}

export function useSaveSalesContact(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SalesContactCreateInput) => {
      if (selectedId !== null) {
        return salesContactsApi.update(selectedId, values);
      }
      return salesContactsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-contacts'] });
    },
  });
}

export function useDeleteSalesContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => salesContactsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['sales-contacts'] });
    },
  });
}
