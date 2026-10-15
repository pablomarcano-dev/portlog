import { apiSend } from '../../../lib/api/sendRequest';
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
    return apiSend(`/dispatch/pedr/${pedrId}/sub-document`, body, (raw) =>
      emailDispatchResponseSchema.parse(raw),
    );
  },

  getLog: async (pedrId: string): Promise<DispatchLogResponse> => {
    const raw = await apiRequest<unknown>(`/dispatch/pedr/${pedrId}/dispatches`);
    return dispatchLogResponseSchema.parse(raw);
  },
};
