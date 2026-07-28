import { queryOptions, useQuery } from '@tanstack/react-query';
import type { NominationListSearch, NominationListResponse } from '@portlog/schemas';
import { nominationsApi } from '../api';

export const nominationListQueryOptions = (query: Partial<NominationListSearch>) =>
  queryOptions<NominationListResponse>({
    queryKey: ['nominations', 'list', query],
    queryFn: () => nominationsApi.list(query),
    staleTime: 30_000,
  });

export function useNominationList(query: Partial<NominationListSearch>) {
  return useQuery(nominationListQueryOptions(query));
}
