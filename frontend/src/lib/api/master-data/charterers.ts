import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type {
  ChartererCreateInput,
  ChartererUpdateInput,
  ChartererListQuery,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ChartererRecord {
  id: string;
  name: string;
  address?: string | null;
  contactInfo?: string | null;
  comments?: string | null;
  label: string;
}

export interface ChartererListResponse {
  items: ChartererRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const charterersApi = {
  list: (query?: Partial<ChartererListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ChartererListResponse>(`/master-data/charterers${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ChartererRecord>(`/master-data/charterers/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/charterers/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ChartererCreateInput) =>
    apiRequest<ChartererRecord>('/master-data/charterers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ChartererUpdateInput) =>
    apiRequest<ChartererRecord>(`/master-data/charterers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/charterers/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const charterersQueryOptions = (query?: Partial<ChartererListQuery>) =>
  queryOptions({
    queryKey: ['charterers', 'list', query],
    queryFn: () => charterersApi.list(query),
    staleTime: 30_000,
  });

export const chartererQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['charterers', id],
    queryFn: () => charterersApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useCharterers(query?: Partial<ChartererListQuery>) {
  return useQuery(charterersQueryOptions(query));
}

export function useCharterer(id: string) {
  return useQuery(chartererQueryOptions(id));
}

export function useSaveCharterer(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ChartererCreateInput) => {
      if (selectedId !== null) {
        return charterersApi.update(selectedId, values);
      }
      return charterersApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['charterers'] });
    },
  });
}

export function useDeleteCharterer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => charterersApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['charterers'] });
    },
  });
}
