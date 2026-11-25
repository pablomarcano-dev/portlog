import { EmailDeliveryService } from '../email/email-delivery.service.js';
import { Test } from '@nestjs/testing';
import { type CanActivate, type ExecutionContext } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { OperationalAccessGuard } from '../auth/operational-access.guard.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const ID = '9b476a51-11d6-4b19-a012-e7b6900dd880';
class TestIdentity implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = {
      sub: 'person',
      role: req.headers['x-test-role'] ?? 'OPS',
      branchId: req.headers['x-test-branch'] === 'national' ? null : 'plc',
      permissions: [],
    };
    return true;
  }
}

describe('answered permissions over HTTP', () => {
  let app: NestFastifyApplication;
  const svc = {
    update: jest.fn().mockResolvedValue({ saved: true }),
    list: jest.fn().mockResolvedValue({ items: [] }),
    getById: jest.fn().mockResolvedValue({}),
    saveSofTimesheet: jest.fn().mockResolvedValue({ saved: true }),
    transition: jest.fn(),
    create: jest.fn(),
    addClient: jest.fn(),
  };
  const prisma = { nomination: { findUnique: jest.fn().mockResolvedValue({ branchId: 'plc' }) } };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NominationsController],
      providers: [
        { provide: NominationsService, useValue: svc },
        { provide: EmailDeliveryService, useValue: {} },
        { provide: PrismaService, useValue: prisma },
        { provide: APP_GUARD, useClass: TestIdentity },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: APP_GUARD, useClass: OperationalAccessGuard },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => app?.close());
  beforeEach(() => jest.clearAllMocks());

  it('agent patch rejects forbidden valid and unknown fields without calling the service', async () => {
    for (const payload of [
      { lastPortId: 'cmport0000000000000000001', subject: 'forbidden' },
      { unknown: 'would be stripped' },
    ]) {
      const res = await app.inject({ method: 'PATCH', url: `/nominations/${ID}`, payload });
      expect(res.statusCode).toBe(403);
    }
    expect(svc.update).not.toHaveBeenCalled();
  });
  it('agent can patch the three approved fields through validation', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/nominations/${ID}`,
      payload: {
        lastPortId: 'cmport0000000000000000001',
        nextPortId: 'cmport0000000000000000002',
        boardingClerk: '',
      },
    });
    expect(res.statusCode).toBe(200);
    expect(svc.update).toHaveBeenCalledWith(
      ID,
      {
        lastPortId: 'cmport0000000000000000001',
        nextPortId: 'cmport0000000000000000002',
        boardingClerk: '',
      },
      'person',
      false,
    );
  });
  it('agent cannot create or mutate Clients through direct endpoints', async () => {
    for (const url of ['/nominations', `/nominations/${ID}/clients`]) {
      expect((await app.inject({ method: 'POST', url, payload: {} })).statusCode).toBe(403);
    }
    expect(svc.create).not.toHaveBeenCalled();
    expect(svc.addClient).not.toHaveBeenCalled();
  });
  it('scopes agent lists and hides embedded Clients/history while Fleet Manager lists nationally', async () => {
    await app.inject({ method: 'GET', url: '/nominations' });
    expect(svc.list).toHaveBeenLastCalledWith(expect.any(Object), 'plc');
    await app.inject({ method: 'GET', url: `/nominations/${ID}` });
    expect(svc.getById).toHaveBeenLastCalledWith(ID, false);
    await app.inject({
      method: 'GET',
      url: '/nominations',
      headers: { 'x-test-role': 'FLT', 'x-test-branch': 'national' },
    });
    expect(svc.list).toHaveBeenLastCalledWith(expect.any(Object), undefined);
  });
  it('Fleet Manager can fully edit, but cancellation remains Admin only', async () => {
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/nominations/${ID}`,
          headers: { 'x-test-role': 'FLT' },
          payload: { subject: 'updated' },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/nominations/${ID}/transition`,
          headers: { 'x-test-role': 'FLT' },
          payload: { to: 'CANCELLED', reason: 'test' },
        })
      ).statusCode,
    ).toBe(403);
    expect(svc.transition).not.toHaveBeenCalled();
  });
});
