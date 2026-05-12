import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { PortCreateInput, PortUpdateInput } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface PortRecord {
  id: string;
  name: string;
  abbreviation?: string | null;
  location?: string | null;
  parentId?: string | null;
  comments?: string | null;
}

export interface PortDetailRecord extends PortRecord {
  parent: { id: string; name: string; abbreviation?: string | null } | null;
  children: Array<{ id: string; name: string; abbreviation?: string | null }>;
}

export interface PortTreeNode extends PortRecord {
  children: PortTreeNode[];
}

export interface PortListResponse {
  items: Array<PortRecord & { label: string }>;
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const portsApi = {
  list: (params?: { q?: string; limit?: number; cursor?: string; parentId?: string | null }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    if (params?.parentId === null) qs.set('parentId', 'null');
    else if (params?.parentId) qs.set('parentId', params.parentId);
    const query = qs.toString();
    return apiRequest<PortListResponse>(`/master-data/ports${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiRequest<PortDetailRecord>(`/master-data/ports/${id}`),

  tree: () => apiRequest<PortTreeNode[]>(`/master-data/ports/tree`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/ports/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: PortCreateInput) =>
    apiRequest<PortRecord>('/master-data/ports', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: PortUpdateInput) =>
    apiRequest<PortRecord>(`/master-data/ports/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/ports/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const portsTreeQueryOptions = () =>
  queryOptions({
    queryKey: ['ports', 'tree'],
    queryFn: () => portsApi.tree(),
    staleTime: 30_000,
  });

export const portQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['ports', id],
    queryFn: () => portsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function usePortsTree() {
  return useQuery(portsTreeQueryOptions());
}

export function usePort(id: string) {
  return useQuery(portQueryOptions(id));
}

export function useSavePort(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: PortCreateInput) => {
      if (selectedId !== null) {
        return portsApi.update(selectedId, values);
      }
      return portsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ports'] });
    },
  });
}

export function useDeletePort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => portsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ports'] });
    },
  });
}
