import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import type { ComposeData } from '@portlog/schemas';

export function useNominationCompose(
  nominationId: string | undefined,
  actionType: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: ['nomination', nominationId, 'compose', actionType],
    queryFn: () =>
      apiRequest<ComposeData>(`/nominations/${nominationId}/compose/${actionType!.toLowerCase()}`),
    enabled: enabled && !!nominationId && !!actionType,
    staleTime: 10_000,
  });
}
