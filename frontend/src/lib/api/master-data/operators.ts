import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { OperatorCreateInput, OperatorUpdateInput, OperatorListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface OperatorRecord {
  id: string;
  name: string;
  email?: string | null;
  businessPhone?: string | null;
  businessFax?: string | null;
  address?: string | null;
  standardRequirements?: string | null;
  sendCopy: boolean;
  location?: 'L' | 'E' | null;
  comments?: string | null;
  label: string;
}

export interface OperatorListResponse {
  items: OperatorRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const operatorsApi = {
  list: (query?: Partial<OperatorListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<OperatorListResponse>(`/master-data/operators${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<OperatorRecord>(`/master-data/operators/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/operators/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: OperatorCreateInput) =>
    apiRequest<OperatorRecord>('/master-data/operators', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: OperatorUpdateInput) =>
    apiRequest<OperatorRecord>(`/master-data/operators/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/operators/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const operatorsQueryOptions = (query?: Partial<OperatorListQuery>) =>
  queryOptions({
    queryKey: ['operators', 'list', query],
    queryFn: () => operatorsApi.list(query),
    staleTime: 30_000,
  });

export const operatorQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['operators', id],
    queryFn: () => operatorsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useOperators(query?: Partial<OperatorListQuery>) {
  return useQuery(operatorsQueryOptions(query));
}

export function useOperator(id: string) {
  return useQuery(operatorQueryOptions(id));
}

export function useSaveOperator(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: OperatorCreateInput) => {
      if (selectedId !== null) {
        return operatorsApi.update(selectedId, values);
      }
      return operatorsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
    },
  });
}

export function useDeleteOperator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => operatorsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['operators'] });
    },
  });
}
