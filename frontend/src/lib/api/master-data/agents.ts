import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { AgentCreateInput, AgentUpdateInput, AgentListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface AgentRecord {
  id: string;
  name: string;
  address?: string | null;
  contactInfo?: string | null;
  comments?: string | null;
  label: string;
}

export interface AgentListResponse {
  items: AgentRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const agentsApi = {
  list: (query?: Partial<AgentListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<AgentListResponse>(`/master-data/agents${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<AgentRecord>(`/master-data/agents/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/agents/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: AgentCreateInput) =>
    apiRequest<AgentRecord>('/master-data/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: AgentUpdateInput) =>
    apiRequest<AgentRecord>(`/master-data/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/agents/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const agentsQueryOptions = (query?: Partial<AgentListQuery>) =>
  queryOptions({
    queryKey: ['agents', 'list', query],
    queryFn: () => agentsApi.list(query),
    staleTime: 30_000,
  });

export const agentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['agents', id],
    queryFn: () => agentsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useAgents(query?: Partial<AgentListQuery>) {
  return useQuery(agentsQueryOptions(query));
}

export function useAgent(id: string) {
  return useQuery(agentQueryOptions(id));
}

export function useSaveAgent(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: AgentCreateInput) => {
      if (selectedId !== null) {
        return agentsApi.update(selectedId, values);
      }
      return agentsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
