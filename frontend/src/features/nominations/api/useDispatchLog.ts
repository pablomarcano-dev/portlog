import { queryOptions, useQuery } from '@tanstack/react-query';
import type { DispatchLogResponse } from '@portlog/schemas';
import { dispatchApi } from './dispatchApi';

export const dispatchLogQueryOptions = (pedrId: string) =>
  queryOptions<DispatchLogResponse>({
    queryKey: ['dispatch', 'log', pedrId],
    queryFn: () => dispatchApi.getLog(pedrId),
    staleTime: 30_000,
    enabled: Boolean(pedrId),
  });

export function useDispatchLog(pedrId: string) {
  return useQuery(dispatchLogQueryOptions(pedrId));
}
