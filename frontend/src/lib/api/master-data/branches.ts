import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { BranchCreate, BranchUpdate, BranchListQuery } from '@portlog/schemas';

export interface BranchRecord {
  id: string;
  name: string;
  code: string;
  comments?: string | null;
  label: string;
}

export interface BranchListResponse {
  items: BranchRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const branchesApi = {
  list: (query?: Partial<BranchListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<BranchListResponse>(`/master-data/branches${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<BranchRecord>(`/master-data/branches/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/branches/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: BranchCreate) =>
    apiRequest<BranchRecord>('/master-data/branches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: BranchUpdate) =>
    apiRequest<BranchRecord>(`/master-data/branches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/branches/${id}`, { method: 'DELETE' }),
};

export const branchesQueryOptions = (query?: Partial<BranchListQuery>) =>
  queryOptions({
    queryKey: ['branches', 'list', query],
    queryFn: () => branchesApi.list(query),
    staleTime: 30_000,
  });

export const branchQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['branches', id],
    queryFn: () => branchesApi.get(id),
    staleTime: 30_000,
  });

export function useBranches(query?: Partial<BranchListQuery>) {
  return useQuery(branchesQueryOptions(query));
}

export function useBranch(id: string) {
  return useQuery(branchQueryOptions(id));
}

export function useSaveBranch(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: BranchCreate) => {
      if (selectedId !== null) {
        return branchesApi.update(selectedId, values);
      }
      return branchesApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => branchesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['branches'] });
    },
  });
}
