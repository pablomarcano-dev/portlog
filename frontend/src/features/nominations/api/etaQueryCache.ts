import type { QueryClient } from '@tanstack/react-query';
import type { EtaRecordResponse } from '@portlog/schemas';

/** Discard composed messages whose dates were rendered before the saved ETA. */
export async function updateEtaQueryCache(
  queryClient: QueryClient,
  nominationId: string | undefined,
  saved: EtaRecordResponse,
): Promise<void> {
  const composeKey = ['nomination', nominationId, 'compose'];
  await queryClient.cancelQueries({ queryKey: composeKey });
  queryClient.removeQueries({ queryKey: composeKey });
  queryClient.setQueryData(['nomination', nominationId, 'eta'], saved);
}
