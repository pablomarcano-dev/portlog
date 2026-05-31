import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import { ApiError } from '../errors';
import type {
  ShipParticularCreateInput,
  ShipParticularUpdateInput,
  ShipParticularListQuery,
} from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ShipParticularRecord {
  id: string;
  callSign?: string | null;
  name: string;
  abbreviation?: string | null;
  loa?: number | null;
  dwt?: number | null;
  grt?: number | null;
  nrt?: number | null;
  email?: string | null;
  imoNumber?: string | null;
  phone?: string | null;
  phone2?: string | null;
  fax?: string | null;
  flagId: string;
  ownerId?: string | null;
  operatorId?: string | null;
  comments?: string | null;
  label: string;
}

export interface ShipParticularListResponse {
  items: ShipParticularRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const shipParticularsApi = {
  list: (query?: Partial<ShipParticularListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ShipParticularListResponse>(
      `/master-data/ship-particulars${qs ? `?${qs}` : ''}`,
    );
  },

  get: (id: string) => apiRequest<ShipParticularRecord>(`/master-data/ship-particulars/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/ship-particulars/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ShipParticularCreateInput) =>
    apiRequest<ShipParticularRecord>('/master-data/ship-particulars', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ShipParticularUpdateInput) =>
    apiRequest<ShipParticularRecord>(`/master-data/ship-particulars/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiRequest<void>(`/master-data/ship-particulars/${id}`, { method: 'DELETE' }),

  // Returns null when no ship particular with that IMO exists (404 → null).
  getByImo: async (imo: string): Promise<ShipParticularRecord | null> => {
    try {
      return await apiRequest<ShipParticularRecord>(`/master-data/ship-particulars/by-imo/${imo}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  },
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const shipParticularsQueryOptions = (query?: Partial<ShipParticularListQuery>) =>
  queryOptions({
    queryKey: ['ship-particulars', 'list', query],
    queryFn: () => shipParticularsApi.list(query),
    staleTime: 30_000,
  });

export const shipParticularQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['ship-particulars', id],
    queryFn: () => shipParticularsApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useShipParticulars(query?: Partial<ShipParticularListQuery>) {
  return useQuery(shipParticularsQueryOptions(query));
}

export function useShipParticular(id: string) {
  return useQuery(shipParticularQueryOptions(id));
}

export function useSaveShipParticular(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ShipParticularCreateInput) => {
      if (selectedId !== null) {
        return shipParticularsApi.update(selectedId, values);
      }
      return shipParticularsApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ship-particulars'] });
    },
  });
}

export function useShipParticularByImo(imo: string | null) {
  return useQuery({
    queryKey: ['ship-particulars', 'by-imo', imo],
    queryFn: () => shipParticularsApi.getByImo(imo!),
    enabled: imo !== null,
    staleTime: 30_000,
    retry: false,
  });
}

export function useDeleteShipParticular() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shipParticularsApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ship-particulars'] });
    },
  });
}
