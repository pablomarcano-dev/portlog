import { NominationsService } from './nominations.service.js';
import { PedrService } from '../pedr/pedr.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from '../email/email.service.js';
import type { AttachmentsService } from '../attachments/attachments.service.js';
import type { EmailTemplateService } from '../email-templates/email-template.service.js';

// Verify database predicates themselves, rather than relying only on controller delegation.
describe('branch-scoped reads', () => {
  const prisma = {
    nomination: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pedr: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const service = new NominationsService(
    prisma as unknown as PrismaService,
    {} as EmailService,
    {} as AttachmentsService,
    {} as EmailTemplateService,
  );
  beforeEach(() => jest.clearAllMocks());
  it('scopes both nomination page and count by branch, without restricting the creator', async () => {
    await service.list({ page: 1, pageSize: 25, search: 'vessel' }, 'plc');
    const where = prisma.nomination.findMany.mock.calls[0]![0].where;
    expect(where.branchId).toBe('plc');
    expect(where).not.toHaveProperty('createdById');
    expect(prisma.nomination.count).toHaveBeenCalledWith({ where });
    expect(where.AND).toEqual(expect.any(Array));
  });
  it('distinguishes national access from an unassigned agent', async () => {
    await service.list({ page: 1, pageSize: 25 }, undefined);
    expect(prisma.nomination.findMany.mock.calls[0]![0].where).not.toHaveProperty('branchId');
    await service.list({ page: 1, pageSize: 25 }, null);
    expect(prisma.nomination.findMany.mock.calls[1]![0].where.branchId).toBe('__unassigned__');
  });
  it('omits embedded Clients and status history from the agent detail response', async () => {
    prisma.nomination.findUnique.mockResolvedValue({
      id: 'call',
      status: 'NOMINATED',
      correlative: 1,
      kind: 'SN',
      dateNominated: new Date('2026-11-25T12:00:00Z'),
      layDaysFirst: null,
      layDaysLast: null,
      pedr: null,
      nominationClients: [{ name: 'billing contact' }],
      statusHistory: [{ changedById: 'manager' }],
    });
    const detail = await service.getById('call', false);
    expect(detail.nominationClients).toEqual([]);
    expect(detail.statusHistory).toEqual([]);
    const managerDetail = await service.getById('call', true);
    expect(managerDetail.nominationClients).toEqual([{ name: 'billing contact' }]);
  });
  it('redacts Clients/history from the agent PATCH response too', async () => {
    const row = {
      id: 'call',
      status: 'NOMINATED',
      correlative: 1,
      kind: 'SN',
      dateNominated: new Date('2026-11-25T12:00:00Z'),
      layDaysFirst: null,
      layDaysLast: null,
      pedr: null,
      nominationClients: [{ name: 'billing contact' }],
      statusHistory: [{ changedById: 'manager' }],
    };
    prisma.nomination.findUnique.mockResolvedValue(row);
    prisma.nomination.update.mockResolvedValue(row);
    const detail = await service.update('call', { boardingClerk: '' }, 'agent', false);
    expect(detail.nominationClients).toEqual([]);
    expect(detail.statusHistory).toEqual([]);
  });
  it('keeps branch and text filters together in PEDR reads', async () => {
    const pedr = new PedrService(prisma as unknown as PrismaService);
    await pedr.list({ pageSize: 25, nominationSearch: 'vessel' }, 'plc');
    expect(prisma.pedr.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: [{ nomination: { branchId: 'plc' } }],
          nomination: expect.any(Object),
        }),
      }),
    );
  });
});
