import { useMutation } from '@tanstack/react-query';
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
  return useMutation({
    mutationFn: (body: SendEmailBody) =>
      apiRequest<void>(`/nominations/${nominationId}/send-email`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}
