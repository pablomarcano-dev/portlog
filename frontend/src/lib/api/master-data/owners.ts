import { useQuery, useMutation, useQueryClient, queryOptions } from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { OwnerCreateInput, OwnerUpdateInput, OwnerListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface OwnerRecord {
  id: string;
  nombre: string;
  listadoContacto?: string | null;
  cantidad?: number | null;
  numeroContacto?: string | null;
  direccionFisica?: string | null;
  telefonos?: string | null;
  direccion?: string | null;
  cargo?: string | null;
  redesSociales?: string | null;
  comentarios?: string | null;
  cumpleanos?: string | null;
  gustos?: string | null;
  recomendaciones?: string | null;
  business?: string | null;
  webpage?: string | null;
  // Financial fields — only present when caller has owner.financial permission
  acuerdos?: string | null;
  historyJson?: Record<string, unknown> | null;
  comments?: string | null;
  label: string;
}

export interface OwnerListResponse {
  items: OwnerRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const ownersApi = {
  list: (query?: Partial<OwnerListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<OwnerListResponse>(`/master-data/owners${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<OwnerRecord>(`/master-data/owners/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/owners/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: OwnerCreateInput) =>
    apiRequest<OwnerRecord>('/master-data/owners', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: OwnerUpdateInput) =>
    apiRequest<OwnerRecord>(`/master-data/owners/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/owners/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const ownersQueryOptions = (query?: Partial<OwnerListQuery>) =>
  queryOptions({
    queryKey: ['owners', 'list', query],
    queryFn: () => ownersApi.list(query),
    staleTime: 30_000,
  });

export const ownerQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['owners', id],
    queryFn: () => ownersApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useOwners(query?: Partial<OwnerListQuery>) {
  return useQuery(ownersQueryOptions(query));
}

export function useOwner(id: string) {
  return useQuery(ownerQueryOptions(id));
}

export function useSaveOwner(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: OwnerCreateInput) => {
      if (selectedId !== null) {
        return ownersApi.update(selectedId, values);
      }
      return ownersApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['owners'] });
    },
  });
}

export function useDeleteOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ownersApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['owners'] });
    },
  });
}
