import { useQuery } from '@tanstack/react-query';
import { fetchAisVessel } from '../api';

export function useAisLookup(imo: string | null | undefined) {
  return useQuery({
    queryKey: ['ais', imo],
    queryFn: () => fetchAisVessel(imo!),
    enabled: !!imo && /^\d{7}$/.test(imo),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
