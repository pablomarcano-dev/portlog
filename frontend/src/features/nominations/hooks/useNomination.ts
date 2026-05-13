import { queryOptions, useQuery } from '@tanstack/react-query';
import type { Nomination } from '@portlog/schemas';
import { nominationsApi } from '../api';

export const nominationQueryOptions = (id: string) =>
  queryOptions<Nomination>({
    queryKey: ['nominations', id],
    queryFn: () => nominationsApi.get(id),
    staleTime: 30_000,
  });

export function useNomination(id: string) {
  return useQuery(nominationQueryOptions(id));
}
