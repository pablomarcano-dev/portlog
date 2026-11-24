import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import { useCurrentUser } from '../../../lib/auth/queries';
import { nominationComposeQueryKey } from './nominationComposeQueryKey';
import type { ComposeData, OperationalUpdateComposeQuery } from '@portlog/schemas';

export function useNominationCompose(
  nominationId: string | undefined,
  actionType: string | undefined,
  enabled = true,
  options: OperationalUpdateComposeQuery = {},
) {
  const { data: user } = useCurrentUser();
  const query = new URLSearchParams(options).toString();
  return useQuery({
    queryKey: [
      ...nominationComposeQueryKey(nominationId, actionType, user?.id),
      ...(query ? [options] : []),
    ],
    queryFn: () =>
      apiRequest<ComposeData>(
        `/nominations/${nominationId}/compose/${actionType!.toLowerCase()}${query ? `?${query}` : ''}`,
      ),
    enabled: enabled && !!nominationId && !!actionType && !!user?.id,
    staleTime: 10_000,
  });
}
