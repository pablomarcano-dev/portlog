import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { SendSubDocumentInput } from '@portlog/schemas';
import { dispatchApi } from './dispatchApi';

export function useEmailDispatch(pedrId: string, nominationId?: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: SendSubDocumentInput) => dispatchApi.send(pedrId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dispatch', 'log', pedrId] });
      if (nominationId) {
        void qc.invalidateQueries({ queryKey: ['nomination', nominationId, 'messages'] });
      }
      notifications.show({
        title: 'Email sent',
        message: 'The document has been sent successfully.',
        color: 'green',
      });
    },
    onError: (err: unknown) => {
      notifications.show({
        title: 'Send failed',
        message: err instanceof Error ? err.message : 'Failed to send email.',
        color: 'red',
      });
    },
  });
}
