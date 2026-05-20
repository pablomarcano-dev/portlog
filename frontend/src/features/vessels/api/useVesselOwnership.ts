import { useQueries } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import type { VesselOwnership } from '@portlog/schemas';

interface OwnershipResponse {
  data: VesselOwnership[] | null;
  meta?: { success: boolean };
}

/**
 * Fan-out ownership fetch: one query per IMO via the ownership Datalastic endpoint.
 * Returns a stable Map<imo, VesselOwnership>.
 */
export function useVesselOwnership(imos: string[]): Map<string, VesselOwnership> {
  const results = useQueries({
    queries: imos.map((imo) => ({
      queryKey: ['datalastic', 'ownership', imo],
      queryFn: () => apiRequest<OwnershipResponse>(`/datalastic/ownership?imo=${imo}`),
      staleTime: 5 * 60 * 1_000,
      enabled: !!imo && imo !== '0',
    })),
  });

  const map = new Map<string, VesselOwnership>();
  results.forEach((result, i) => {
    const imo = imos[i];
    if (result.data?.data?.[0] && imo) {
      map.set(imo, result.data.data[0]);
    }
  });
  return map;
}
