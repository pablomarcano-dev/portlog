import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import type { ComposeData, OperationalUpdateComposeQuery } from '@portlog/schemas';

export function useNominationCompose(
  nominationId: string | undefined,
  actionType: string | undefined,
  enabled = true,
  options: OperationalUpdateComposeQuery = {},
) {
  const query = new URLSearchParams(options).toString();
  return useQuery({
    // Preserve existing compose keys when there are no operational draft options.
    queryKey: ['nomination', nominationId, 'compose', actionType, ...(query ? [options] : [])],
    queryFn: () =>
      apiRequest<ComposeData>(
        `/nominations/${nominationId}/compose/${actionType!.toLowerCase()}${query ? `?${query}` : ''}`,
      ),
    enabled: enabled && !!nominationId && !!actionType,
    staleTime: 10_000,
  });
}
