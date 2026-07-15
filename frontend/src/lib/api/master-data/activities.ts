import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  queryOptions,
} from '@tanstack/react-query';
import { apiRequest } from '../client';
import type { ActivityCreateInput, ActivityUpdateInput, ActivityListQuery } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Types mirroring backend response shapes
// ---------------------------------------------------------------------------

export interface ActivityRecord {
  id: string;
  name: string;
  comments?: string | null;
  label: string;
}

export interface ActivityListResponse {
  items: ActivityRecord[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export const activitiesApi = {
  list: (query?: Partial<ActivityListQuery>) => {
    const params = new URLSearchParams();
    if (query?.q) params.set('q', query.q);
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.cursor) params.set('cursor', query.cursor);
    const qs = params.toString();
    return apiRequest<ActivityListResponse>(`/master-data/activities${qs ? `?${qs}` : ''}`);
  },

  get: (id: string) => apiRequest<ActivityRecord>(`/master-data/activities/${id}`),

  search: (q: string) =>
    apiRequest<Array<{ id: string; label: string }>>(
      `/master-data/activities/search?q=${encodeURIComponent(q)}`,
    ),

  create: (data: ActivityCreateInput) =>
    apiRequest<ActivityRecord>('/master-data/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: ActivityUpdateInput) =>
    apiRequest<ActivityRecord>(`/master-data/activities/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  delete: (id: string) => apiRequest<void>(`/master-data/activities/${id}`, { method: 'DELETE' }),
};

// ---------------------------------------------------------------------------
// Query options
// ---------------------------------------------------------------------------

export const activitiesQueryOptions = (query?: Partial<ActivityListQuery>) =>
  queryOptions({
    queryKey: ['activities', 'list', query],
    queryFn: () => activitiesApi.list(query),
    staleTime: 30_000,
  });

export const activityQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['activities', id],
    queryFn: () => activitiesApi.get(id),
    staleTime: 30_000,
  });

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useActivities(query?: Partial<ActivityListQuery>) {
  return useQuery(activitiesQueryOptions(query));
}

/** Fetches all activities, paging in automatically as the caller reaches the end (`fetchNextPage`). */
export function useActivitiesInfinite(query?: Partial<Omit<ActivityListQuery, 'cursor'>>) {
  return useInfiniteQuery({
    queryKey: ['activities', 'list', 'infinite', query],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      activitiesApi.list({ ...query, limit: query?.limit ?? 100, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.nextCursor ?? undefined) : undefined,
    staleTime: 30_000,
  });
}

export function useActivity(id: string) {
  return useQuery(activityQueryOptions(id));
}

export function useActivitySearch(q: string) {
  return useQuery({
    queryKey: ['activities', 'search', q],
    queryFn: () => activitiesApi.search(q),
    staleTime: 30_000,
  });
}

export function useSaveActivity(selectedId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (values: ActivityCreateInput) => {
      if (selectedId !== null) {
        return activitiesApi.update(selectedId, values);
      }
      return activitiesApi.create(values);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useDeleteActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => activitiesApi.delete(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}
