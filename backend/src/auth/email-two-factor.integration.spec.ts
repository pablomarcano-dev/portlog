import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import cookie from '@fastify/cookie';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import { EmailService } from '../email/email.service.js';
import { AuditService } from '../audit/audit.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { EmailTwoFactorService } from './email-two-factor.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

// Explicit opt-in. Never fall back to the application's DATABASE_URL.
const url = process.env['TEST_TWO_FACTOR_DATABASE_URL'];
const describeDatabase = url ? describe : describe.skip;
const PASSWORD = 'synthetic-test-password-only';
const SECRET = 'synthetic-test-secret-not-for-real-deployment';

describeDatabase('Email two-factor authentication — isolated PostgreSQL and HTTP', () => {
  let app: NestFastifyApplication;
  let db: PrismaService;
  let userId: string;
  const send = jest.fn();
  let code: string;
  const request = (path: string, body: object, token?: string) =>
    app.inject({
      method: 'POST',
      url: `/auth/${path}`,
      payload: body,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  const login = () => request('login', { email: 'twofactor@example.test', password: PASSWORD });
  const verify = (challengeId: string, value = code) =>
    request('two-factor/verify', { challengeId, code: value });
  const enable = async () =>
    db.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });

  beforeAll(async () => {
    db = new PrismaService({ datasources: { db: { url } } });
    await db.$connect();
    const module = await Test.createTestingModule({
      imports: [PassportModule, JwtModule.register({ secret: SECRET })],
      controllers: [AuthController],
      providers: [
        AuthService,
        EmailTwoFactorService,
        UsersService,
        AuditService,
        JwtStrategy,
        { provide: PrismaService, useValue: db },
        { provide: EmailService, useValue: { send } },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => (key === 'JWT_ACCESS_SECRET' ? SECRET : undefined) },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  beforeEach(async () => {
    // Only this test's explicitly marked synthetic identities are reset.
    await db.user.deleteMany({
      where: { email: { in: ['twofactor@example.test', 'other-twofactor@example.test'] } },
    });
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    userId = (
      await db.user.create({ data: { email: 'twofactor@example.test', role: 'ADM', passwordHash } })
    ).id;
    await db.user.create({
      data: { email: 'other-twofactor@example.test', role: 'ADM', passwordHash },
    });
    send.mockReset();
    send.mockImplementation(async (opts: { html: string }) => {
      code = opts.html.match(/<strong>(\d{6})<\/strong>/)![1]!;
    });
  });
  afterAll(async () => {
    await app?.close();
    await db?.$disconnect();
  });

  it('preserves password-only accounts and never sends a code for a bad password', async () => {
    expect((await login()).json().accessToken).toBeDefined();
    expect(send).not.toHaveBeenCalled();
    await enable();
    const bad = await request('login', {
      email: 'twofactor@example.test',
      password: 'wrong-password',
    });
    expect(bad.statusCode).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });
  it('issues no session until the code is verified; stores no plaintext code; rejects replay', async () => {
    await enable();
    const res = await login();
    const challenge = res.json();
    expect(challenge.twoFactorRequired).toBe(true);
    expect(challenge.accessToken).toBeUndefined();
    expect(String(res.headers['set-cookie'] ?? '')).not.toMatch(/refresh_token=[a-f0-9]{64}/);
    expect(await db.refreshToken.count({ where: { userId } })).toBe(0);
    const stored = await db.emailTwoFactorChallenge.findUniqueOrThrow({
      where: { id: challenge.challengeId },
    });
    expect(stored.codeHash).toHaveLength(64);
    expect(stored.codeHash).not.toBe(code);
    expect(send.mock.calls[0][0].to).toEqual(['twofactor@example.test']);
    const verified = await verify(challenge.challengeId);
    expect(verified.statusCode).toBe(201);
    expect(verified.json().accessToken).toBeDefined();
    expect(String(verified.headers['set-cookie'])).toMatch(/refresh_token=[a-f0-9]{64}/);
    expect((await verify(challenge.challengeId)).statusCode).toBe(401);
  });
  it('rejects expired codes and locks the challenge after five incorrect codes', async () => {
    await enable();
    const challenge = (await login()).json();
    const wrong = code === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++)
      expect((await verify(challenge.challengeId, wrong)).statusCode).toBe(401);
    expect((await verify(challenge.challengeId)).statusCode).toBe(401);
    await db.emailTwoFactorChallenge.update({
      where: { id: challenge.challengeId },
      data: { attempts: 0, expiresAt: new Date(Date.now() - 1) },
    });
    expect((await verify(challenge.challengeId)).statusCode).toBe(401);
    expect(await db.refreshToken.count({ where: { userId } })).toBe(0);
  });
  it('allows exactly one of ten simultaneous redemptions', async () => {
    await enable();
    const { challengeId } = (await login()).json();
    const responses = await Promise.all(Array.from({ length: 10 }, () => verify(challengeId)));
    expect(responses.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(responses.filter((r) => r.statusCode === 401)).toHaveLength(9);
    expect(await db.refreshToken.count({ where: { userId } })).toBe(1);
  });
  it('bounds sends per account across simultaneous requests; replacement invalidates the previous code', async () => {
    await enable();
    const first = (await login()).json();
    const firstCode = code;
    expect((await login()).statusCode).toBe(429);
    await db.user.update({ where: { id: userId }, data: { twoFactorLastSentAt: new Date(0) } });
    const replies = await Promise.all(Array.from({ length: 4 }, () => login()));
    expect(replies.filter((r) => r.statusCode === 201)).toHaveLength(1);
    expect(replies.filter((r) => r.statusCode === 429)).toHaveLength(3);
    expect((await verify(first.challengeId, firstCode)).statusCode).toBe(401);
  });
  it('keeps 2FA on after password reset, rejects old codes and deactivated accounts', async () => {
    await enable();
    const { challengeId } = (await login()).json();
    await app.get(UsersService).resetPassword(userId, PASSWORD);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(
      true,
    );
    expect((await verify(challengeId)).statusCode).toBe(401);
    await db.user.update({ where: { id: userId }, data: { twoFactorLastSentAt: new Date(0) } });
    const next = (await login()).json();
    await db.user.update({ where: { id: userId }, data: { isActive: false } });
    expect((await verify(next.challengeId)).statusCode).toBe(401);
  });
  it('requires password and email proof for enrollment, binds purpose/account, and revokes old access and refresh sessions', async () => {
    const logged = await login();
    const token = logged.json().accessToken;
    expect(
      (await request('two-factor/change', { enabled: true, password: 'wrong-password' }, token))
        .statusCode,
    ).toBe(401);
    expect(
      (await request('two-factor/change', { enabled: true, password: PASSWORD })).statusCode,
    ).toBe(401);
    const challenge = (
      await request('two-factor/change', { enabled: true, password: PASSWORD }, token)
    ).json();
    expect((await verify(challenge.challengeId)).statusCode).toBe(401);
    const other = (
      await request('login', { email: 'other-twofactor@example.test', password: PASSWORD })
    ).json().accessToken;
    expect(
      (await request('two-factor/confirm', { ...challenge, code, enabled: true }, other))
        .statusCode,
    ).toBe(400);
    expect(
      (
        await request(
          'two-factor/confirm',
          { challengeId: challenge.challengeId, code, enabled: true },
          other,
        )
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request(
          'two-factor/confirm',
          { challengeId: challenge.challengeId, code, enabled: false },
          token,
        )
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await request(
          'two-factor/confirm',
          { challengeId: challenge.challengeId, code, enabled: true },
          token,
        )
      ).statusCode,
    ).toBe(201);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(
      true,
    );
    expect(
      (
        await app.inject({
          method: 'GET',
          url: '/auth/me',
          headers: { authorization: `Bearer ${token}` },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/auth/refresh',
          headers: { cookie: String(logged.headers['set-cookie']).split(';')[0]! },
        })
      ).statusCode,
    ).toBe(401);
    expect(await db.refreshToken.count({ where: { userId, revokedAt: null } })).toBe(0);
    expect((await login()).json().twoFactorRequired).toBe(true);
  });
  it('requires the emailed code to disable and does not permit a login code as a disable code', async () => {
    await enable();
    const challenge = (await login()).json();
    const loginCode = code;
    const token = (await verify(challenge.challengeId)).json().accessToken;
    expect(
      (
        await request(
          'two-factor/confirm',
          { challengeId: challenge.challengeId, code: loginCode, enabled: false },
          token,
        )
      ).statusCode,
    ).toBe(401);
    await db.user.update({ where: { id: userId }, data: { twoFactorLastSentAt: new Date(0) } });
    const disable = (
      await request('two-factor/change', { enabled: false, password: PASSWORD }, token)
    ).json();
    expect(
      (
        await request(
          'two-factor/confirm',
          { challengeId: disable.challengeId, code, enabled: false },
          token,
        )
      ).statusCode,
    ).toBe(201);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(
      false,
    );
    expect((await login()).json().accessToken).toBeDefined();
  });
  it('fails closed on delivery failure and never enables the factor or exposes codes', async () => {
    const token = (await login()).json().accessToken;
    send.mockRejectedValue(new Error('synthetic SMTP outage'));
    const response = await request(
      'two-factor/change',
      { enabled: true, password: PASSWORD },
      token,
    );
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain('synthetic SMTP outage');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled).toBe(
      false,
    );
    expect(await db.emailTwoFactorChallenge.count({ where: { userId, consumedAt: null } })).toBe(0);
    expect(
      (
        await request(
          'two-factor/change',
          { enabled: true, password: PASSWORD, email: 'attacker@example.test' },
          token,
        )
      ).statusCode,
    ).toBe(400);
  });
});
