import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api/client';
import type { EtaRecordResponse } from '@portlog/schemas';

export function useNominationEta(nominationId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['nomination', nominationId, 'eta'],
    queryFn: () => apiRequest<EtaRecordResponse>(`/nominations/${nominationId}/eta`),
    enabled: !!nominationId && enabled,
    staleTime: 0,
  });
}
