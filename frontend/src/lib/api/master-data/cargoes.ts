import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type {
  CargoCreateInput,
  CargoUpdateInput,
  CargoListQuery,
  CargoCategory,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface CargoRecord {
  id: string;
  name: string;
  bblUnit: string;
  category: CargoCategory;
  comments?: string | null;
  label: string;
}

export interface CargoListResponse {
  items: CargoRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const cargoesApi = {
  list: (query?: Partial<CargoListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    if (query?.category) params.set('category', query.category);
    const qs = params.toString();
    return apiRequest<CargoListResponse>(`/master-data/cargoes${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<CargoRecord>(`/master-data/cargoes/${id}`),

  search: (q: string, category?: CargoCategory) => {
    const params = new URLSearchParams({ q });
    if (category) params.set('category', category);
    return apiRequest<Array<{ id: string; label: string; category: CargoCategory }>>(
      `/master-data/cargoes/search?${params.toString()}`,
    );
  },

  create: (data: CargoCreateInput) =>
    apiRequest<CargoRecord>('/master-data/cargoes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: CargoUpdateInput) =>
    apiRequest<CargoRecord>(`/master-data/cargoes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/cargoes/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const cargoesQueryOptions = (query?: Partial<CargoListQuery>) =>
  queryOptions({
    queryKey: ['cargoes', 'list', query],
    queryFn: () => cargoesApi.list(query),
    staleTime: 30_000,
  });

export const cargoQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['cargoes', id],
    queryFn: () => cargoesApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useCargoes(query?: Partial<CargoListQuery>) {
  return useQuery(cargoesQueryOptions(query));
}

export function useCargo(id: string) {
  return useQuery(cargoQueryOptions(id));
}

export function useSaveCargo(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CargoCreateInput) => {
      if (selectedId !== null) {
        return cargoesApi.update(selectedId, values);
      }
      return cargoesApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cargoes'] });
    },
  });
}

export function useDeleteCargo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cargoesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cargoes'] });
    },
  });
}
