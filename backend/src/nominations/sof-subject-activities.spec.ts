import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { RolesGuard } from '../auth/roles.guard.js';
import { SofSubjectActivitiesController } from './sof-subject-activities.controller.js';
import { SofSubjectActivitiesService } from './sof-subject-activities.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('SOF subject catalog HTTP authorization', () => {
  let app: NestFastifyApplication;
  const service = {
    list: jest.fn(() => []),
    save: jest.fn(() => ({ id: 'label' })),
    options: jest.fn(() => ({ items: [], suggestedId: null })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SofSubjectActivitiesController],
      providers: [
        { provide: SofSubjectActivitiesService, useValue: service },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app
      .getHttpAdapter()
      .getInstance()
      .addHook('preHandler', (request, _reply, done) => {
        Object.assign(request, { user: { sub: 'user', role: request.headers['x-test-role'] } });
        done();
      });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('allows OPS to read nomination choices but forbids catalog management', async () => {
    const inject = app
      .getHttpAdapter()
      .getInstance()
      .inject.bind(app.getHttpAdapter().getInstance());
    expect(
      (
        await inject({
          method: 'GET',
          url: '/nominations/6039ed24-664e-48ed-8ca9-a0acc7419d83/sof-subject-activities',
          headers: { 'x-test-role': 'OPS' },
        })
      ).statusCode,
    ).toBe(200);
    for (const method of ['GET', 'POST', 'PATCH'] as const) {
      const response = await inject({
        method,
        url: '/admin/sof-subject-activities' + (method === 'PATCH' ? '/label' : ''),
        headers: { 'x-test-role': 'OPS' },
        ...(method !== 'GET' ? { payload: { label: 'All Fast' } } : {}),
      });
      expect(response.statusCode).toBe(403);
    }
    expect(service.save).not.toHaveBeenCalled();
  });
  it('validates Admin catalog writes and allows deactivation instead of deletion', async () => {
    const server = app.getHttpAdapter().getInstance();
    expect(
      (
        await server.inject({
          method: 'POST',
          url: '/admin/sof-subject-activities',
          headers: { 'x-test-role': 'ADM' },
          payload: { label: ' ' },
        })
      ).statusCode,
    ).toBe(400);
    expect(service.save).not.toHaveBeenCalled();
    expect(
      (
        await server.inject({
          method: 'PATCH',
          url: '/admin/sof-subject-activities/label',
          headers: { 'x-test-role': 'ADM' },
          payload: { label: 'All Fast', eventNames: [], active: false },
        })
      ).statusCode,
    ).toBe(200);
    expect(service.save).toHaveBeenCalledWith(
      { label: 'All Fast', eventNames: [], active: false },
      'label',
    );
  });
});

describe('SOF subject catalog suggestions', () => {
  it('uses the latest saved SOF event without modifying the timesheet', async () => {
    const prisma = {
      nomination: {
        findUnique: jest.fn(async () => ({
          sofTimesheet: {
            entries: [
              { occurredAt: new Date('2026-11-24T10:00:00Z'), activity: { name: 'Pilot boarded' } },
            ],
          },
        })),
      },
      sofSubjectActivity: {
        findMany: jest.fn(async () => [
          { id: 'pilot', label: 'Pilot On Board', eventNames: ['Pilot boarded'], active: true },
        ]),
      },
    };
    const svc = new SofSubjectActivitiesService(prisma as unknown as PrismaService);
    expect(await svc.options('nomination')).toMatchObject({ suggestedId: 'pilot' });
    expect(prisma.sofSubjectActivity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
    );
  });
});
