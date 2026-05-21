import { queryOptions, useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';

interface PedrSummary {
  id: string;
  nominationId: string;
  currentStage: string;
}

export const pedrByNominationQueryOptions = (nominationId: string) =>
  queryOptions<PedrSummary | null>({
    queryKey: ['pedr', 'by-nomination', nominationId],
    queryFn: async () => {
      try {
        return await apiRequest<PedrSummary>(`/pedr/by-nomination/${nominationId}`);
      } catch {
        // 404 means no PEDR yet for this nomination
        return null;
      }
    },
    staleTime: 30_000,
    enabled: Boolean(nominationId),
  });

export function usePedrByNomination(nominationId: string) {
  return useQuery(pedrByNominationQueryOptions(nominationId));
}
