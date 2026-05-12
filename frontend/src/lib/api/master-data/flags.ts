import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { FlagCreateInput, FlagUpdateInput, FlagListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface FlagRecord {
  id: string;
  name: string;
  abbreviation?: string | null;
  comments?: string | null;
  label: string;
}

export interface FlagListResponse {
  items: FlagRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const flagsApi = {
  list: (query?: Partial<FlagListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<FlagListResponse>(`/master-data/flags${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<FlagRecord>(`/master-data/flags/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/flags/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: FlagCreateInput) =>
    apiRequest<FlagRecord>('/master-data/flags', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: FlagUpdateInput) =>
    apiRequest<FlagRecord>(`/master-data/flags/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/flags/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options (for prefetching and reuse)
// ---------------------------------------------------------------------------

export const flagsQueryOptions = (query?: Partial<FlagListQuery>) =>
  queryOptions({
    queryKey: ['flags', 'list', query],
    queryFn: () => flagsApi.list(query),
    staleTime: 30_000,
  });

export const flagQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['flags', id],
    queryFn: () => flagsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useFlags(query?: Partial<FlagListQuery>) {
  return useQuery(flagsQueryOptions(query));
}

export function useFlag(id: string) {
  return useQuery(flagQueryOptions(id));
}

export function useSaveFlag(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: FlagCreateInput) => {
      if (selectedId !== null) {
        return flagsApi.update(selectedId, values);
      }
      return flagsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['flags'] });
    },
  });
}

export function useDeleteFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flagsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['flags'] });
    },
  });
}
