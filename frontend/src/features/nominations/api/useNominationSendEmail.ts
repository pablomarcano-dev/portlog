import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { apiRequest } from '../../../lib/api/client';

interface SendEmailBody {
  subDocType: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  bodyHtml: string;
}

export function useNominationSendEmail(nominationId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: SendEmailBody) =>
      apiRequest<void>(`/nominations/${nominationId}/send-email`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      if (nominationId) {
        void qc.invalidateQueries({ queryKey: ['nomination', nominationId, 'messages'] });
      }
      notifications.show({
        title: 'Email sent',
        message: 'The email has been sent successfully.',
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
