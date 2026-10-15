import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNominationSendEmail } from '../api/useNominationSendEmail';

const api = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../../../lib/api/sendRequest', () => ({ apiSend: api.request }));
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }));
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: (options: unknown) => options,
}));

const body = {
  subDocType: 'ETA_RECAP',
  subject: 'Draft',
  bodyText: 'Draft body',
  toAddresses: ['client@example.test'],
  ccAddresses: [],
  bccAddresses: [],
};
const receipt = {
  id: 'persisted-dispatch',
  pedrId: 'pedr-1',
  subDocType: 'ETA_RECAP',
  subject: 'Recorded subject',
  toAddresses: ['client@example.test'],
  ccAddresses: ['branch@example.test'],
  bodyHtml: '<pre>Recorded body</pre>',
  pdfStorageKey: null,
  sentAt: '2026-10-15T16:00:00.000Z',
  sentById: 'user-1',
  error: null,
  createdAt: '2026-10-15T15:59:59.000Z',
};

function send() {
  return (
    useNominationSendEmail('nom-1') as unknown as {
      mutationFn: (input: typeof body) => Promise<unknown>;
    }
  ).mutationFn(body);
}

beforeEach(() => vi.clearAllMocks());

describe('nomination email receipt', () => {
  it('requests and returns the persisted receipt instead of reconstructing the sent draft', async () => {
    api.request.mockResolvedValue(receipt);
    expect(await send()).toEqual(receipt);
    expect(api.request).toHaveBeenCalledWith('/nominations/nom-1/send-email?receipt=true', body);
  });

  it('does not turn a successful legacy 204 into a send failure or trigger a second send', async () => {
    api.request.mockResolvedValue(undefined);
    expect(await send()).toBeNull();
    expect(api.request).toHaveBeenCalledTimes(1);
  });
});
