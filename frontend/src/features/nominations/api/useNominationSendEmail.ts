import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import { emailDispatchResponseSchema } from '@portlog/schemas';
import { apiSend } from '../../../lib/api/sendRequest';

interface SendEmailBody {
  subDocType: string;
  toAddresses: string[];
  ccAddresses: string[];
  bccAddresses: string[];
  subject: string;
  /** Plain text — the backend wraps it for mail clients at send time. */
  bodyText: string;
  attachmentIds?: string[];
}

export function useNominationSendEmail(nominationId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: SendEmailBody) => {
      const raw = await apiSend<unknown>(
        `/nominations/${nominationId}/send-email?receipt=true`,
        body,
      );
      // A successful send remains successful if an older server returns no
      // receipt. Never encourage a duplicate send just because printing failed.
      const parsed = emailDispatchResponseSchema.safeParse(raw);
      return parsed.success ? parsed.data : null;
    },
    onSuccess: () => {
      if (nominationId) {
        void qc.invalidateQueries({ queryKey: ['nomination', nominationId] });
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
