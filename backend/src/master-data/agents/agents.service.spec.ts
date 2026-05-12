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
