import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordSchema } from '@portlog/schemas';
import { generateSecurePassword } from './password-generator';

afterEach(() => vi.restoreAllMocks());

describe('generateSecurePassword', () => {
  it('uses fresh cryptographic randomness for each 20-character password', () => {
    const random = vi.spyOn(globalThis.crypto, 'getRandomValues');
    const first = generateSecurePassword();
    const second = generateSecurePassword();

    expect(random).toHaveBeenCalledTimes(2);
    expect(random.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
    expect(random.mock.calls[0]?.[0]).not.toBe(random.mock.calls[1]?.[0]);
    for (const password of [first, second]) {
      expect(password).toMatch(/^[A-Za-z0-9_-]{20}$/);
      expect(ResetPasswordSchema.safeParse({ newPassword: password }).success).toBe(true);
    }
  });

  it('maps bytes uniformly across all 64 symbols, including byte boundaries', () => {
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((array) => {
      const bytes = array as Uint8Array;
      bytes.fill(0);
      bytes.set([0, 25, 26, 51, 52, 61, 62, 63, 64, 255]);
      return array;
    });

    expect(generateSecurePassword()).toBe('AZaz09-_A_AAAAAAAAAA');
  });

  it('fails when cryptographic randomness fails instead of falling back to Math.random', () => {
    const insecureRandom = vi.spyOn(Math, 'random');
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Random source unavailable');
    });

    expect(() => generateSecurePassword()).toThrow('Random source unavailable');
    expect(insecureRandom).not.toHaveBeenCalled();
  });
});
