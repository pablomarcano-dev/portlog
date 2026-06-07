import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest } from '../../../lib/api/client';
import type { EtaRecordSaveInput, EtaRecordResponse } from '@portlog/schemas';

export function useNominationEtaSave(nominationId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: EtaRecordSaveInput) =>
      apiRequest<EtaRecordResponse>(`/nominations/${nominationId}/eta`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nomination', nominationId, 'eta'] });
      notifications.show({ color: 'green', message: 'ETA record saved.' });
    },
    onError: (err) => {
      notifications.show({
        color: 'red',
        title: 'Save failed',
        message: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    },
  });
}
