import { apiRequest } from '../../../lib/api/client';
import {
  dispatchLogResponseSchema,
  emailDispatchResponseSchema,
  type SendSubDocumentInput,
  type EmailDispatchResponse,
  type DispatchLogResponse,
} from '@portlog/schemas';

export const dispatchApi = {
  send: async (pedrId: string, body: SendSubDocumentInput): Promise<EmailDispatchResponse> => {
    const raw = await apiRequest<unknown>(`/dispatch/pedr/${pedrId}/sub-document`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return emailDispatchResponseSchema.parse(raw);
  },

  getLog: async (pedrId: string): Promise<DispatchLogResponse> => {
    const raw = await apiRequest<unknown>(`/dispatch/pedr/${pedrId}/dispatches`);
    return dispatchLogResponseSchema.parse(raw);
  },
};
