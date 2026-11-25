import { type ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
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
    serviceRequest: { findUnique: jest.fn() },
    emailAttachment: { findUnique: jest.fn() },
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
  it('allows branch coworkers to download filed receipts while denying foreign receipts', async () => {
    const req = request({ url: '/api/attachments/receipt/download', params: { id: 'receipt' } });
    prisma.emailAttachment.findUnique.mockResolvedValue({
      uploadedById: 'another-agent',
      serviceRequestReceipt: { branchId: 'plc' },
    });
    await expect(guard.canActivate(context(req))).resolves.toBe(true);
    prisma.emailAttachment.findUnique.mockResolvedValue({
      uploadedById: 'agent',
      serviceRequestReceipt: { branchId: 'mbo' },
    });
    await expect(guard.canActivate(context(req))).rejects.toThrow(ForbiddenException);
  });
  it('checks all direct service request reads, writes and archived dispatch downloads', async () => {
    for (const [method, suffix] of [
      ['GET', ''],
      ['PATCH', ''],
      ['DELETE', ''],
      ['POST', '/approve'],
      ['POST', '/receipt'],
      ['POST', '/transition'],
      ['POST', '/documents'],
      ['DELETE', '/documents/attachment'],
      ['POST', '/generate'],
      ['GET', '/order.pdf'],
      ['GET', '/order.docx'],
      ['POST', '/send'],
      ['GET', '/dispatches'],
      ['GET', '/dispatches/dispatch/order.pdf'],
      ['GET', '/dispatches/dispatch/order.docx'],
    ]) {
      const req = request({
        method,
        url: `/api/service-requests/request${suffix}`,
        params: { id: 'request' },
      });
      prisma.serviceRequest.findUnique.mockResolvedValue({ branchId: 'mbo' });
      await expect(guard.canActivate(context(req))).rejects.toThrow(ForbiddenException);
      prisma.serviceRequest.findUnique.mockResolvedValue({ branchId: 'plc' });
      await expect(guard.canActivate(context(req))).resolves.toBe(true);
    }
  });
  it('rejects missing or unassigned direct service requests before their handlers run', async () => {
    const req = request({ url: '/api/service-requests/request', params: { id: 'request' } });
    prisma.serviceRequest.findUnique.mockResolvedValue(null);
    await expect(guard.canActivate(context(req))).rejects.toThrow(NotFoundException);
    prisma.serviceRequest.findUnique.mockResolvedValue({ branchId: 'plc' });
    await expect(
      guard.canActivate(context({ ...req, user: { sub: 'agent', role: 'OPS', branchId: null } })),
    ).rejects.toThrow(ForbiddenException);
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
