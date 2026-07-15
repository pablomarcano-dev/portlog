import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { CrewCreateInput, CrewUpdateInput, CrewListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface CrewRecord {
  id: string;
  name: string;
  position?: string | null;
  documentNumber?: string | null;
  nationality?: string | null;
  comments?: string | null;
  label: string;
}

export interface CrewListResponse {
  items: CrewRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const crewApi = {
  list: (query?: Partial<CrewListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<CrewListResponse>(`/master-data/crew${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<CrewRecord>(`/master-data/crew/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/crew/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: CrewCreateInput) =>
    apiRequest<CrewRecord>('/master-data/crew', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: CrewUpdateInput) =>
    apiRequest<CrewRecord>(`/master-data/crew/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/crew/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options (for prefetching and reuse)
// ---------------------------------------------------------------------------

export const crewListQueryOptions = (query?: Partial<CrewListQuery>) =>
  queryOptions({
    queryKey: ['crew', 'list', query],
    queryFn: () => crewApi.list(query),
    staleTime: 30_000,
  });

export const crewQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['crew', id],
    queryFn: () => crewApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useCrewList(query?: Partial<CrewListQuery>) {
  return useQuery(crewListQueryOptions(query));
}

export function useCrewMember(id: string) {
  return useQuery(crewQueryOptions(id));
}

export function useSaveCrew(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: CrewCreateInput) => {
      if (selectedId !== null) {
        return crewApi.update(selectedId, values);
      }
      return crewApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['crew'] });
    },
  });
}

export function useDeleteCrew() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => crewApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['crew'] });
    },
  });
}
