import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest } from '../client';
import type { PortCreateInput, PortUpdateInput } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface PortRecord {
  id: string;
  name: string;
  abbreviation?: string | null;
  country?: string | null;
  emailGroup?: string | null;
  comments?: string | null;
}

export interface PierRecord {
  id: string;
  name: string;
  portId: string;
}

export interface PortDetailRecord extends PortRecord {
  piers: PierRecord[];
}

export interface PortListResponse {
  items: Array<PortRecord & { label: string }>;
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Port API functions
// ---------------------------------------------------------------------------

export const portsApi = {
  list: (params?: { q?: string; limit?: number; cursor?: string }) => {
    const qs = new URLSearchParams();
    if (params?.q) qs.set('q', params.q);
    if (params?.limit != null) qs.set('limit', String(params.limit));
    if (params?.cursor) qs.set('cursor', params.cursor);
    const query = qs.toString();
    return apiRequest<PortListResponse>(`/master-data/ports${query ? `?${query}` : ''}`);
  },

  get: (id: string) => apiRequest<PortDetailRecord>(`/master-data/ports/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/ports/search?q=${encodeURIComponent(q)}`,
    ),

  countries: () => apiRequest<string[]>('/master-data/ports/countries'),

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
// Pier API functions
// ---------------------------------------------------------------------------

export const piersApi = {
  list: (portId: string) =>
    apiRequest<{ items: PierRecord[] }>(`/master-data/ports/${portId}/piers`),

  create: (portId: string, name: string) =>
    apiRequest<PierRecord>(`/master-data/ports/${portId}/piers`, {
      method: 'POST',
      body: JSON.stringify({ name, portId }),
    }),

  update: (portId: string, pierId: string, name: string) =>
    apiRequest<PierRecord>(`/master-data/ports/${portId}/piers/${pierId}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    }),

  delete: (portId: string, pierId: string) =>
    apiRequest<void>(`/master-data/ports/${portId}/piers/${pierId}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Port query options + hooks
// ---------------------------------------------------------------------------

export const portQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['ports', id],
    queryFn: () => portsApi.get(id),
    staleTime: 30_000,
  });

export function usePort(id: string) {
  return useQuery(portQueryOptions(id));
}

export function usePortCountries() {
  return useQuery({
    queryKey: ['ports', 'countries'],
    queryFn: () => portsApi.countries(),
    staleTime: 60_000,
  });
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
    onError: (err) => {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
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

// ---------------------------------------------------------------------------
// Pier hooks
// ---------------------------------------------------------------------------

export function usePiers(portId: string | null) {
  return useQuery({
    queryKey: ['piers', portId],
    queryFn: () => piersApi.list(portId!),
    enabled: portId !== null,
    staleTime: 30_000,
  });
}

export function useSavePier(portId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id?: string; name: string }) => {
      if (id) return piersApi.update(portId, id, name);
      return piersApi.create(portId, name);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['piers', portId] });
      void qc.invalidateQueries({ queryKey: ['ports', portId] });
    },
  });
}

export function useDeletePier(portId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pierId: string) => piersApi.delete(portId, pierId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['piers', portId] });
      void qc.invalidateQueries({ queryKey: ['ports', portId] });
    },
  });
}
