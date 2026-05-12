import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ShipperCreateInput, ShipperUpdateInput, ShipperListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ShipperRecord {
  id: string;
  name: string;
  email?: string | null;
  businessPhone?: string | null;
  businessFax?: string | null;
  address?: string | null;
  comments?: string | null;
  label: string;
}

export interface ShipperListResponse {
  items: ShipperRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const shippersApi = {
  list: (query?: Partial<ShipperListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ShipperListResponse>(`/master-data/shippers${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ShipperRecord>(`/master-data/shippers/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/shippers/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ShipperCreateInput) =>
    apiRequest<ShipperRecord>('/master-data/shippers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ShipperUpdateInput) =>
    apiRequest<ShipperRecord>(`/master-data/shippers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/shippers/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const shippersQueryOptions = (query?: Partial<ShipperListQuery>) =>
  queryOptions({
    queryKey: ['shippers', 'list', query],
    queryFn: () => shippersApi.list(query),
    staleTime: 30_000,
  });

export const shipperQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['shippers', id],
    queryFn: () => shippersApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useShippers(query?: Partial<ShipperListQuery>) {
  return useQuery(shippersQueryOptions(query));
}

export function useShipper(id: string) {
  return useQuery(shipperQueryOptions(id));
}

export function useSaveShipper(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ShipperCreateInput) => {
      if (selectedId !== null) {
        return shippersApi.update(selectedId, values);
      }
      return shippersApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shippers'] });
    },
  });
}

export function useDeleteShipper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shippersApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shippers'] });
    },
  });
}
