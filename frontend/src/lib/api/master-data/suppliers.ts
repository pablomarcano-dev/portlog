import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { SupplierCreateInput, SupplierUpdateInput, SupplierListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface SupplierRecord {
  id: string;
  name: string;
  contacts?: string | null;
  address?: string | null;
  services?: string | null;
  kyc?: string | null;
  phones?: string | null;
  emails?: string | null;
  certificates?: string | null;
  rates?: string | null;
  serviceContract?: string | null;
  agreements?: string | null;
  comments?: string | null;
  label: string;
}

export interface SupplierListResponse {
  items: SupplierRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const suppliersApi = {
  list: (query?: Partial<SupplierListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<SupplierListResponse>(`/master-data/suppliers${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<SupplierRecord>(`/master-data/suppliers/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/suppliers/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: SupplierCreateInput) =>
    apiRequest<SupplierRecord>('/master-data/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: SupplierUpdateInput) =>
    apiRequest<SupplierRecord>(`/master-data/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/suppliers/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const suppliersQueryOptions = (query?: Partial<SupplierListQuery>) =>
  queryOptions({
    queryKey: ['suppliers', 'list', query],
    queryFn: () => suppliersApi.list(query),
    staleTime: 30_000,
  });

export const supplierQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['suppliers', id],
    queryFn: () => suppliersApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useSuppliers(query?: Partial<SupplierListQuery>) {
  return useQuery(suppliersQueryOptions(query));
}

export function useSupplier(id: string) {
  return useQuery(supplierQueryOptions(id));
}

export function useSaveSupplier(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: SupplierCreateInput) => {
      if (selectedId !== null) {
        return suppliersApi.update(selectedId, values);
      }
      return suppliersApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}

export function useDeleteSupplier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
}
