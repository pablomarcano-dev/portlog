import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import cookie from '@fastify/cookie';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { throttlingOptions } from '../common/throttling.js';

describe('Authentication rate limits', () => {
  let app: NestFastifyApplication;
  afterEach(async () => {
    await app?.close();
  });

  async function start(environment: string | undefined) {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot(throttlingOptions(environment))],
      controllers: [AuthController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        {
          provide: AuthService,
          useValue: {
            login: jest.fn().mockResolvedValue({
              rawRefreshToken: 'isolated-test-refresh',
              loginResponse: { accessToken: 'isolated-test-access' },
            }),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.register(cookie);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  }

  const login = () =>
    app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'fixture@portlog.local', password: 'isolated-test-only' },
    });

  it.each(['production', 'development', undefined])(
    'blocks the sixth login in %s',
    async (environment) => {
      await start(environment);
      for (let i = 0; i < 5; i++) expect((await login()).statusCode).toBe(201);
      expect((await login()).statusCode).toBe(429);
    },
  );

  it('allows the isolated Cypress suite to reuse its loopback IP', async () => {
    await start('test');
    for (let i = 0; i < 12; i++) expect((await login()).statusCode).toBe(201);
  });
});
