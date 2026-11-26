import { LoginOutcomeSchema, VerifyEmailCodeSchema, TwoFactorChangeSchema } from '../index';

describe('email code boundary', () => {
  it('requires exactly six digits and an opaque challenge', () => {
    for (const code of ['12345', '1234567', '12345a', ' 123456'])
      expect(VerifyEmailCodeSchema.safeParse({ challengeId: 'a'.repeat(64), code }).success).toBe(
        false,
      );
    expect(VerifyEmailCodeSchema.parse({ challengeId: 'a'.repeat(64), code: '012345' }).code).toBe(
      '012345',
    );
    expect(
      VerifyEmailCodeSchema.safeParse({ challengeId: 'person-id', code: '012345' }).success,
    ).toBe(false);
  });
  it('never accepts a caller-selected delivery email or management user', () => {
    expect(
      TwoFactorChangeSchema.safeParse({
        enabled: true,
        password: 'password',
        email: 'attacker@example.test',
      }).success,
    ).toBe(false);
    expect(
      VerifyEmailCodeSchema.safeParse({
        challengeId: 'a'.repeat(64),
        code: '123456',
        userId: 'other',
      }).success,
    ).toBe(false);
  });
  it('parses a challenge without pretending it is an authenticated session', () => {
    const result = LoginOutcomeSchema.parse({
      twoFactorRequired: true,
      challengeId: 'a'.repeat(64),
      maskedEmail: 'p***@example.test',
      expiresAt: new Date().toISOString(),
    });
    expect('accessToken' in result).toBe(false);
  });
});
