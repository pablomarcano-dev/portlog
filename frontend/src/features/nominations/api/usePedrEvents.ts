import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { pedrEventResponseSchema } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

const pedrEventsResponseSchema = z.array(pedrEventResponseSchema);
type PedrEventsResponse = z.infer<typeof pedrEventsResponseSchema>;

export const pedrEventsQueryOptions = (pedrId: string) =>
  queryOptions<PedrEventsResponse>({
    queryKey: ['pedr', 'events', pedrId],
    queryFn: async () => {
      const raw = await apiRequest<unknown>(`/pedr/${pedrId}/events`);
      return pedrEventsResponseSchema.parse(raw);
    },
    staleTime: 30_000,
    enabled: Boolean(pedrId),
  });

export function usePedrEvents(pedrId: string) {
  return useQuery(pedrEventsQueryOptions(pedrId));
}
