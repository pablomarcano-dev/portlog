import { type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { OperationalAccessGuard } from './operational-access.guard.js';
import { type PrismaService } from '../prisma/prisma.service.js';

function request(overrides: Record<string, unknown> = {}) {
  return {
    method: 'GET',
    url: '/api/nominations/call',
    params: { id: 'call' },
    user: { sub: 'agent', role: 'OPS', branchId: 'plc' },
    ...overrides,
  };
}
function context(req: unknown): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as ExecutionContext;
}

describe('OperationalAccessGuard', () => {
  const prisma = {
    nomination: { findUnique: jest.fn() },
    pedr: { findUnique: jest.fn() },
  };
  let guard: OperationalAccessGuard;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.nomination.findUnique.mockResolvedValue({ branchId: 'plc' });
    guard = new OperationalAccessGuard(prisma as unknown as PrismaService);
  });

  it('allows every voyage in the current branch independent of creator', async () => {
    await expect(guard.canActivate(context(request()))).resolves.toBe(true);
  });
  it('rejects direct links and email sends outside the current branch', async () => {
    prisma.nomination.findUnique.mockResolvedValue({ branchId: 'mbo' });
    for (const suffix of ['', '/send-email', '/nomination-instructions.docx', '/sof']) {
      await expect(
        guard.canActivate(context(request({ url: `/api/nominations/call${suffix}` }))),
      ).rejects.toThrow(ForbiddenException);
    }
  });
  it('denies unassigned agents rather than exposing unassigned voyages', async () => {
    await expect(
      guard.canActivate(context(request({ user: { sub: 'agent', role: 'OPS', branchId: null } }))),
    ).rejects.toThrow(ForbiddenException);
  });
  it('allows national Fleet Manager access without treating the job title as permission', async () => {
    await expect(
      guard.canActivate(context(request({ user: { sub: 'manager', role: 'FLT' } }))),
    ).resolves.toBe(true);
    prisma.nomination.findUnique.mockResolvedValue({ branchId: 'mbo' });
    await expect(
      guard.canActivate(
        context(
          request({
            user: { sub: 'agent', role: 'OPS', branchId: 'plc', operationalRole: 'BRANCH_MANAGER' },
          }),
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
  });
  it('blocks agent create, directory mutation, parcels and client/billing access', async () => {
    for (const [method, url] of [
      ['POST', '/api/nominations'],
      ['POST', '/api/master-data/ports'],
      ['PATCH', '/api/master-data/clients/client'],
      ['GET', '/api/master-data/clients'],
      ['PATCH', '/api/nominations/call/parcels'],
      ['GET', '/api/nominations/call/clients'],
      ['PUT', '/api/nominations/call/administrative-billing/PORT_COST'],
    ])
      await expect(guard.canActivate(context(request({ method, url })))).rejects.toThrow(
        ForbiddenException,
      );
  });
  it('rejects forbidden patch fields before schema stripping can hide them', async () => {
    for (const body of [
      { lastPortId: 'port', branchId: 'mbo' },
      { parcels: [] },
      { vesselVoyageNumber: '42' },
      { unknownField: true },
    ]) {
      await expect(guard.canActivate(context(request({ method: 'PATCH', body })))).rejects.toThrow(
        ForbiddenException,
      );
    }
    await expect(
      guard.canActivate(
        context(request({ method: 'PATCH', body: { lastPortId: 'port', nextPortId: 'next' } })),
      ),
    ).resolves.toBe(true);
  });
  it('retains agent SOF and ETA updates in their authorized branch', async () => {
    for (const suffix of ['sof', 'eta'])
      await expect(
        guard.canActivate(
          context(
            request({
              method: 'PUT',
              url: `/api/nominations/call/${suffix}`,
              body: { events: [] },
            }),
          ),
        ),
      ).resolves.toBe(true);
  });
  it('resolves PEDR and dispatch direct IDs to their nomination before access', async () => {
    prisma.pedr.findUnique.mockResolvedValue({ nominationId: 'foreign-call' });
    prisma.nomination.findUnique.mockResolvedValue({ branchId: 'mbo' });
    await expect(
      guard.canActivate(
        context(
          request({ url: '/api/dispatch/pedr/pedr-1/dispatches', params: { pedrId: 'pedr-1' } }),
        ),
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.nomination.findUnique).toHaveBeenCalledWith({
      where: { id: 'foreign-call' },
      select: { branchId: true },
    });
  });
});
