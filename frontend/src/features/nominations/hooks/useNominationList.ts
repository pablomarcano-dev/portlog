import { queryOptions, useQuery } from '@tanstack/react-query';
import type { NominationListQuery, NominationListResponse } from '@portlog/schemas';
import { nominationsApi } from '../api';

export const nominationListQueryOptions = (query: Partial<NominationListQuery>) =>
  queryOptions<NominationListResponse>({
    queryKey: ['nominations', 'list', query],
    queryFn: () => nominationsApi.list(query),
    staleTime: 30_000,
  });

export function useNominationList(query: Partial<NominationListQuery>) {
  return useQuery(nominationListQueryOptions(query));
}
