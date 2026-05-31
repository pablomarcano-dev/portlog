import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ClientCreateInput, ClientUpdateInput, ClientListQuery } from '@portlog/schemas';

export interface ClientRecord {
  id: string;
  name: string;
  phone?: string | null;
  phone2?: string | null;
  physicalAddress?: string | null;
  billingAddress?: string | null;
  postalAddress?: string | null;
  taxAddress?: string | null;
  otherAddress?: string | null;
  fax?: string | null;
  mobile?: string | null;
  email?: string | null;
  emailGroup?: string | null;
  tariff?: string | null;
  instructions?: string | null;
  label: string;
}

export interface ClientListResponse {
  items: ClientRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

export const clientsApi = {
  list: (query?: Partial<ClientListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ClientListResponse>(`/master-data/clients${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ClientRecord>(`/master-data/clients/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/clients/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ClientCreateInput) =>
    apiRequest<ClientRecord>('/master-data/clients', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ClientUpdateInput) =>
    apiRequest<ClientRecord>(`/master-data/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/clients/${id}`, { method: 'DELETE' }),
};

export const clientsQueryOptions = (query?: Partial<ClientListQuery>) =>
  queryOptions({
    queryKey: ['clients', 'list', query],
    queryFn: () => clientsApi.list(query),
    staleTime: 30_000,
  });

export const clientQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['clients', id],
    queryFn: () => clientsApi.get(id),
    staleTime: 30_000,
  });

export function useClients(query?: Partial<ClientListQuery>) {
  return useQuery(clientsQueryOptions(query));
}

export function useClient(id: string) {
  return useQuery(clientQueryOptions(id));
}

export function useSaveClient(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ClientCreateInput) => {
      if (selectedId !== null) {
        return clientsApi.update(selectedId, values);
      }
      return clientsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clientsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}
