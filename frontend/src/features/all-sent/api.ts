import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api/client';
import { AllSentResponseSchema, type AllSentFilters, type AllSentResponse } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Raw API
// ---------------------------------------------------------------------------

async function fetchAllSent(filters: AllSentFilters): Promise<AllSentResponse> {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.portId) params.set('portId', filters.portId);
  const raw = await apiRequest<unknown>(`/all-sent?${params.toString()}`);
  return AllSentResponseSchema.parse(raw);
}

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const allSentKeys = {
  list: (filters: AllSentFilters) => ['all-sent', filters] as const,
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAllSent(filters: AllSentFilters) {
  return useQuery({
    queryKey: allSentKeys.list(filters),
    queryFn: () => fetchAllSent(filters),
    staleTime: 30_000,
  });
}
