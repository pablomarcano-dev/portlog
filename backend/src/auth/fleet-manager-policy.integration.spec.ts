import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { type CanActivate, type ExecutionContext } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { RolesGuard } from './roles.guard.js';
import { OperationalAccessGuard } from './operational-access.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PedrController } from '../pedr/pedr.controller.js';
import { PedrService } from '../pedr/pedr.service.js';
import { AdministrativeNominationInstructionsController } from '../nominations/administrative-nomination-instructions.controller.js';
import { AdministrativeNominationInstructionsService } from '../nominations/administrative-nomination-instructions.service.js';
import { NominationsController } from '../nominations/nominations.controller.js';
import { NominationsService } from '../nominations/nominations.service.js';
import { UsersAdminController } from '../users/users-admin.controller.js';
import { UsersService } from '../users/users.service.js';
import { ClientsController } from '../master-data/clients/clients.controller.js';
import { ClientsService } from '../master-data/clients/clients.service.js';
import { SHDocumentsController } from '../sh-documents/sh-documents.controller.js';
import { SHDocumentsService } from '../sh-documents/sh-documents.service.js';
import { EmailDeliveryService } from '../email/email-delivery.service.js';

const ID = '9b476a51-11d6-4b19-a012-e7b6900dd880';
class FixtureIdentity implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    req.user = {
      sub: 'fixture-person',
      role: req.headers['x-role'] ?? 'FLT',
      operationalRole: req.headers['x-position'] ?? null,
      branchId: null,
      permissions: [],
    };
    return true;
  }
}

describe('Fleet Manager capability defaults over HTTP', () => {
  let app: NestFastifyApplication;
  const pedr = { updateRequirements: jest.fn().mockResolvedValue({ saved: true }) };
  const ni = { diagnostics: jest.fn().mockResolvedValue({ missing: [] }) };
  const users = { list: jest.fn().mockResolvedValue([]) };
  const clients = {
    list: jest.fn().mockResolvedValue({ items: [] }),
    create: jest.fn().mockResolvedValue({ saved: true }),
  };
  const nominations = { list: jest.fn().mockResolvedValue({ items: [] }), transition: jest.fn() };
  const sh = { delete: jest.fn() };
  const db = { nomination: { findUnique: jest.fn() } };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        PedrController,
        AdministrativeNominationInstructionsController,
        NominationsController,
        UsersAdminController,
        ClientsController,
        SHDocumentsController,
      ],
      providers: [
        { provide: PedrService, useValue: pedr },
        { provide: AdministrativeNominationInstructionsService, useValue: ni },
        { provide: NominationsService, useValue: nominations },
        { provide: UsersService, useValue: users },
        { provide: ClientsService, useValue: clients },
        { provide: SHDocumentsService, useValue: sh },
        { provide: PrismaService, useValue: db },
        { provide: EmailDeliveryService, useValue: {} },
        { provide: APP_GUARD, useClass: FixtureIdentity },
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

  it.each(['FLT', 'ADM'])(
    '%s may edit operational PEDR requirements and inspect NI administrative source diagnostics',
    async (role) => {
      const patch = await app.inject({
        method: 'PATCH',
        url: `/pedr/${ID}/requirements`,
        headers: { 'x-role': role },
        payload: { requirements: { boarding: true } },
      });
      expect(patch.statusCode).toBe(200);
      expect(pedr.updateRequirements).toHaveBeenCalledWith(
        ID,
        { requirements: { boarding: true } },
        'fixture-person',
      );
      const diagnostic = await app.inject({
        method: 'GET',
        url: `/nominations/${ID}/administrative-nomination-instructions/diagnostics`,
        headers: { 'x-role': role },
      });
      expect(diagnostic.statusCode).toBe(200);
      expect(diagnostic.headers['cache-control']).toBe('private, no-store');
      expect(ni.diagnostics).toHaveBeenCalledWith(ID);
    },
  );
  it('keeps both management-only endpoints unavailable to agents even with a Fleet Manager title', async () => {
    const headers = { 'x-role': 'OPS', 'x-position': 'FLEET_MANAGER' };
    expect(
      (
        await app.inject({
          method: 'PATCH',
          url: `/pedr/${ID}/requirements`,
          headers,
          payload: { requirements: {} },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `/nominations/${ID}/administrative-nomination-instructions/diagnostics`,
          headers,
        })
      ).statusCode,
    ).toBe(403);
    expect(pedr.updateRequirements).not.toHaveBeenCalled();
    expect(ni.diagnostics).not.toHaveBeenCalled();
  });
  it('allows Fleet Manager national lists and Clients management without allowing account administration', async () => {
    expect((await app.inject({ method: 'GET', url: '/nominations' })).statusCode).toBe(200);
    expect(nominations.list).toHaveBeenCalledWith(expect.any(Object), undefined);
    expect((await app.inject({ method: 'GET', url: '/master-data/clients' })).statusCode).toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/master-data/clients',
          payload: { name: 'Synthetic client' },
        })
      ).statusCode,
    ).toBe(201);
    expect(clients.create).toHaveBeenCalled();
    expect((await app.inject({ method: 'GET', url: '/admin/users' })).statusCode).toBe(403);
    expect(users.list).not.toHaveBeenCalled();
  });
  it('keeps cancellation and SH document deletion Admin only', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/nominations/${ID}/transition`,
          payload: { to: 'CANCELLED', reason: 'synthetic' },
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (await app.inject({ method: 'DELETE', url: `/nominations/${ID}/sh-documents/${ID}` }))
        .statusCode,
    ).toBe(403);
    expect(nominations.transition).not.toHaveBeenCalled();
    expect(sh.delete).not.toHaveBeenCalled();
  });
});
