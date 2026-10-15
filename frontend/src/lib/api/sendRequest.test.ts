import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiSend } from './sendRequest';
const request = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ apiRequest: request }));
let saved: Map<string, string>;
beforeEach(() => {
  saved = new Map();
  request.mockReset();
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
});
describe('safe send request identity', () => {
  it('retains an unresolved key across retries and clears it only on success', async () => {
    request
      .mockRejectedValueOnce(new Error('response lost'))
      .mockResolvedValueOnce({ sentAt: 'saved' });
    await expect(apiSend('/send', { subject: 'one' })).rejects.toThrow('response lost');
    expect(saved.size).toBe(1);
    await apiSend('/send', { subject: 'one' });
    expect(request.mock.calls[0]![1].headers).toEqual(request.mock.calls[1]![1].headers);
    expect(saved.size).toBe(0);
  });
  it('retains the key when receipt validation fails after a successful response', async () => {
    request.mockResolvedValue({ unexpected: true });
    await expect(
      apiSend('/send', {}, () => {
        throw new Error('invalid receipt');
      }),
    ).rejects.toThrow('invalid receipt');
    await apiSend('/send', {});
    expect(request.mock.calls[0]![1].headers).toEqual(request.mock.calls[1]![1].headers);
  });
  it('uses distinct keys for intentional different content', async () => {
    request.mockRejectedValue(new Error('uncertain'));
    await apiSend('/send', { subject: 'one' }).catch(() => undefined);
    await apiSend('/send', { subject: 'two' }).catch(() => undefined);
    expect(request.mock.calls[0]![1].headers).not.toEqual(request.mock.calls[1]![1].headers);
  });
  it('fails closed if the key cannot be saved', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('denied');
      },
    });
    await expect(apiSend('/send', {})).rejects.toThrow('Session storage');
    expect(request).not.toHaveBeenCalled();
  });
});
