import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useLogin, useVerifyLoginCode } from './queries';
import { accessTokenStore } from './accessTokenStore';

const mocks = vi.hoisted(() => ({
  mutation: vi.fn((options) => options),
  request: vi.fn(),
  clear: vi.fn(),
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
}));
vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.mutation,
  useQuery: vi.fn(),
  useQueryClient: () => mocks,
}));
vi.mock('../api/client', () => ({ apiRequest: mocks.request }));
const user = { id: 'person', email: 'person@example.test', role: 'OPS', isActive: true };

describe('two-step login token handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    accessTokenStore.set(null);
  });
  it('does not authenticate or retain previous-account cache when password returns an email challenge', async () => {
    const challenge = {
      twoFactorRequired: true,
      challengeId: 'a'.repeat(64),
      maskedEmail: 'p***@example.test',
      expiresAt: new Date().toISOString(),
    };
    mocks.request.mockResolvedValue(challenge);
    useLogin();
    const options = mocks.mutation.mock.calls[0]![0];
    const outcome = await options.mutationFn({ email: 'person', password: 'test-password' });
    accessTokenStore.set('previous-session');
    options.onSuccess(outcome);
    expect(accessTokenStore.get()).toBe(null);
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.invalidateQueries).not.toHaveBeenCalled();
  });
  it('stores a session only after a verified code response', async () => {
    mocks.request.mockResolvedValue({ accessToken: 'verified-session', user });
    useVerifyLoginCode();
    const options = mocks.mutation.mock.calls[0]![0];
    const outcome = await options.mutationFn({ challengeId: 'a'.repeat(64), code: '123456' });
    expect(accessTokenStore.get()).toBe(null);
    options.onSuccess(outcome);
    expect(accessTokenStore.get()).toBe('verified-session');
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['auth', 'me'],
      expect.objectContaining({ id: 'person' }),
    );
  });
  it('failed verification never changes the token store', async () => {
    mocks.request.mockRejectedValue(new Error('invalid code'));
    useVerifyLoginCode();
    const options = mocks.mutation.mock.calls[0]![0];
    await expect(
      options.mutationFn({ challengeId: 'a'.repeat(64), code: '000000' }),
    ).rejects.toThrow();
    expect(accessTokenStore.get()).toBe(null);
    expect(mocks.setQueryData).not.toHaveBeenCalled();
  });
});
