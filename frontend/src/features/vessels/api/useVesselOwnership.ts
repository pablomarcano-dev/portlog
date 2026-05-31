import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import type { VesselOwnership } from '@portlog/schemas';

interface OwnershipResponse {
  data: VesselOwnership[] | null;
  meta?: { success: boolean };
}

/**
 * Fetches ownership data for a single IMO.
 * Intended to be called inside OwnershipRow, which only mounts when a row is
 * expanded — making the call naturally lazy (no upfront N+1 fan-out).
 */
export function useOwnershipForImo(imo: string): {
  data: VesselOwnership | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: ['datalastic', 'ownership', imo],
    queryFn: () => apiRequest<OwnershipResponse>(`/datalastic/ownership?imo=${imo}`),
    staleTime: 5 * 60 * 1_000,
    enabled: !!imo && imo !== '0',
    retry: false,
  });

  return { data: data?.data?.[0] ?? undefined, isLoading };
}
