import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  NominationMessagesResponseSchema,
  type NominationMessagesResponse,
} from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

export const nominationMessagesQueryOptions = (nominationId: string) =>
  queryOptions<NominationMessagesResponse>({
    queryKey: ['nomination', nominationId, 'messages'],
    queryFn: async () => {
      const raw = await apiRequest<unknown>(`/nominations/${nominationId}/messages`);
      return NominationMessagesResponseSchema.parse(raw);
    },
    staleTime: 30_000,
    enabled: Boolean(nominationId),
  });

export function useNominationMessages(nominationId: string) {
  return useQuery(nominationMessagesQueryOptions(nominationId));
}
