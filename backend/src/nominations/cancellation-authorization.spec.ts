import { UsersService } from '../users/users.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { EmailDeliveryService } from '../email/email-delivery.service.js';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';

// Exercise real JWT/role guards and route validation: denial must happen before
// the service can change a nomination or append cancellation history.
describe('nomination cancellation authorization', () => {
  const secret = 'local-cancellation-authorization-test-secret';
  const url = '/nominations/6039ed24-664e-48ed-8ca9-a0acc7419d83/transition';
  const payload = { toStatus: 'CANCELLED', reason: 'Duplicate nomination' };
  const transition = jest.fn().mockResolvedValue({ status: 'CANCELLED' });
  let app: NestFastifyApplication;
  let fastify: FastifyAdapter;

  const authorization = (role: 'OPS' | 'ADM') =>
    `Bearer ${new JwtService({ secret }).sign({
      sub: role === 'ADM' ? 'administrator' : 'shipping-agent',
      email: `${role.toLowerCase()}@example.test`,
      role,
      permissions: [],
    })}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NominationsController],
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(async (id: string) => ({
              id,
              email: `${id}@example.test`,
              role: id === 'administrator' ? 'ADM' : 'OPS',
              isActive: true,
              permissions: [],
              branchId: 'plc',
              branchAssignments: [],
            })),
          },
        },
        {
          provide: PrismaService,
          useValue: { branch: { findUnique: jest.fn(async () => ({ id: 'plc' })) } },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: NominationsService, useValue: { transition } },
        { provide: EmailDeliveryService, useValue: {} },
      ],
    }).compile();
    fastify = new FastifyAdapter();
    app = module.createNestApplication<NestFastifyApplication>(fastify);
    await app.init();
    await fastify.getInstance().ready();
  });

  afterAll(async () => app?.close());
  beforeEach(() => transition.mockClear());

  it('requires authentication before cancellation', async () => {
    const response = await fastify.getInstance().inject({ method: 'POST', url, payload });
    expect(response.statusCode).toBe(401);
    expect(transition).not.toHaveBeenCalled();
  });

  it('rejects direct OPS cancellation requests without changing records', async () => {
    const response = await fastify.getInstance().inject({
      method: 'POST',
      url,
      payload,
      headers: { authorization: authorization('OPS') },
    });
    expect(response.statusCode).toBe(403);
    expect(transition).not.toHaveBeenCalled();
  });

  it('does not accept a body-supplied administrator role from OPS', async () => {
    const response = await fastify.getInstance().inject({
      method: 'POST',
      url,
      payload: { ...payload, role: 'ADM' },
      headers: { authorization: authorization('OPS') },
    });
    expect(response.statusCode).toBe(403);
    expect(transition).not.toHaveBeenCalled();
  });

  it('passes an authenticated administrator and reason through the existing service', async () => {
    const response = await fastify.getInstance().inject({
      method: 'POST',
      url,
      payload,
      headers: { authorization: authorization('ADM') },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ status: 'CANCELLED' });
    expect(transition).toHaveBeenCalledWith(
      '6039ed24-664e-48ed-8ca9-a0acc7419d83',
      payload,
      'administrator',
    );
  });

  it('still rejects an administrator cancellation with no reason', async () => {
    const response = await fastify.getInstance().inject({
      method: 'POST',
      url,
      payload: { toStatus: 'CANCELLED' },
      headers: { authorization: authorization('ADM') },
    });
    expect(response.statusCode).toBe(400);
    expect(transition).not.toHaveBeenCalled();
  });
});
