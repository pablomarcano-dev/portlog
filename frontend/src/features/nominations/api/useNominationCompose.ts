import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import { useCurrentUser } from '../../../lib/auth/queries';
import { nominationComposeQueryKey } from './nominationComposeQueryKey';
import type { ComposeData } from '@portlog/schemas';

export function useNominationCompose(
  nominationId: string | undefined,
  actionType: string | undefined,
  enabled = true,
) {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: nominationComposeQueryKey(nominationId, actionType, user?.id),
    queryFn: () =>
      apiRequest<ComposeData>(`/nominations/${nominationId}/compose/${actionType!.toLowerCase()}`),
    enabled: enabled && !!nominationId && !!actionType && !!user?.id,
    staleTime: 10_000,
  });
}
