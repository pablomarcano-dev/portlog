import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AgentsService } from './agents.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockAgent = {
  id: 'agent-cuid-1',
  name: 'Port Agent Co.',
  address: '1 Harbour Lane',
  contactInfo: '+1 555 0200',
  comments: null,
  label: 'Port Agent Co.',
};

const mockPrisma = {
  agent: {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AgentsService', () => {
  let service: AgentsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AgentsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<AgentsService>(AgentsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([mockAgent]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Port Agent Co.');
      expect(result.hasMore).toBe(false);
    });

    it('scopes results by branch and operational role before pagination', async () => {
      mockPrisma.agent.findMany.mockResolvedValue([]);

      await service.list({
        q: undefined,
        limit: 50,
        cursor: undefined,
        branchId: 'clbranch000000001',
        operationalRole: 'SHIPPING_AGENT',
      });

      expect(mockPrisma.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            branchId: 'clbranch000000001',
            operationalRole: 'SHIPPING_AGENT',
          },
        }),
      );
    });
  });

  describe('getNominationConfigurationHealth', () => {
    it('reports exact availability without inferring branch or role assignments', async () => {
      mockPrisma.agent.count
        .mockResolvedValueOnce(12)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(7);

      const result = await service.getNominationConfigurationHealth();

      expect(result).toEqual({
        total: 12,
        availableForNominations: 3,
        unavailableForNominations: 9,
        partiallyConfigured: 2,
        unassigned: 7,
      });
      expect(mockPrisma.agent.count).toHaveBeenNthCalledWith(2, {
        where: {
          branchId: { not: null },
          operationalRole: { not: null },
        },
      });
      expect(mockPrisma.agent.count).toHaveBeenNthCalledWith(3, {
        where: {
          OR: [
            { branchId: null, operationalRole: { not: null } },
            { branchId: { not: null }, operationalRole: null },
          ],
        },
      });
      expect(mockPrisma.agent.count).toHaveBeenNthCalledWith(4, {
        where: { branchId: null, operationalRole: null },
      });
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the agent when found', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);

      const result = await service.getById('agent-cuid-1');

      expect(result.name).toBe('Port Agent Co.');
    });

    it('throws NotFoundException when agent does not exist', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new agent', async () => {
      mockPrisma.agent.create.mockResolvedValue(mockAgent);

      const result = await service.create({ name: 'Port Agent Co.' });

      expect(result.name).toBe('Port Agent Co.');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.agent.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Port Agent Co.' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the agent', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.agent.update.mockResolvedValue({ ...mockAgent, address: '2 New Wharf' });

      const result = await service.update('agent-cuid-1', { address: '2 New Wharf' });

      expect(result.address).toBe('2 New Wharf');
    });

    it('passes a cleared branch through as null', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.agent.update.mockResolvedValue({ ...mockAgent, branchId: null });

      await service.update('agent-cuid-1', { branchId: null });

      expect(mockPrisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { branchId: null } }),
      );
    });

    it('passes a cleared mobile through as null', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.agent.update.mockResolvedValue({ ...mockAgent, mobile: null });

      await service.update('agent-cuid-1', { mobile: null });

      expect(mockPrisma.agent.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { mobile: null } }),
      );
    });

    it('throws NotFoundException when agent does not exist', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the agent successfully', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(mockAgent);
      mockPrisma.agent.delete.mockResolvedValue(mockAgent);

      await expect(service.remove('agent-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when agent does not exist', async () => {
      mockPrisma.agent.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
