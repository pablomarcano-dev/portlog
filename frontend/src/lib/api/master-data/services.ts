import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ServiceCreateInput, ServiceUpdateInput, ServiceListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ServiceRecord {
  id: string;
  name: string;
  comments?: string | null;
  label: string;
}

export interface ServiceListResponse {
  items: ServiceRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const servicesApi = {
  list: (query?: Partial<ServiceListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ServiceListResponse>(`/master-data/services${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ServiceRecord>(`/master-data/services/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/services/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ServiceCreateInput) =>
    apiRequest<ServiceRecord>('/master-data/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ServiceUpdateInput) =>
    apiRequest<ServiceRecord>(`/master-data/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/services/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options (for prefetching and reuse)
// ---------------------------------------------------------------------------

export const servicesListQueryOptions = (query?: Partial<ServiceListQuery>) =>
  queryOptions({
    queryKey: ['services', 'list', query],
    queryFn: () => servicesApi.list(query),
    staleTime: 30_000,
  });

export const serviceQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['services', id],
    queryFn: () => servicesApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useServicesList(query?: Partial<ServiceListQuery>) {
  return useQuery(servicesListQueryOptions(query));
}

export function useService(id: string) {
  return useQuery(serviceQueryOptions(id));
}

export function useSaveService(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ServiceCreateInput) => {
      if (selectedId !== null) {
        return servicesApi.update(selectedId, values);
      }
      return servicesApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
