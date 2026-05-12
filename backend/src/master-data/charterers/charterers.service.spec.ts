import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CharterersService } from './charterers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockCharterer = {
  id: 'charterer-cuid-1',
  name: 'Acme Chartering',
  address: '123 Port Road',
  contactInfo: 'John Doe +1 555 0100',
  comments: null,
  label: 'Acme Chartering',
};

const mockPrisma = {
  charterer: {
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

describe('CharterersService', () => {
  let service: CharterersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CharterersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CharterersService>(CharterersService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.charterer.findMany.mockResolvedValue([mockCharterer]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Acme Chartering');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the charterer when found', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(mockCharterer);

      const result = await service.getById('charterer-cuid-1');

      expect(result.name).toBe('Acme Chartering');
    });

    it('throws NotFoundException when charterer does not exist', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new charterer', async () => {
      mockPrisma.charterer.create.mockResolvedValue(mockCharterer);

      const result = await service.create({ name: 'Acme Chartering' });

      expect(result.name).toBe('Acme Chartering');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.charterer.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Acme Chartering' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the charterer', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(mockCharterer);
      mockPrisma.charterer.update.mockResolvedValue({ ...mockCharterer, address: '456 New St' });

      const result = await service.update('charterer-cuid-1', { address: '456 New St' });

      expect(result.address).toBe('456 New St');
    });

    it('throws NotFoundException when charterer does not exist', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the charterer successfully', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(mockCharterer);
      mockPrisma.charterer.delete.mockResolvedValue(mockCharterer);

      await expect(service.remove('charterer-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when charterer does not exist', async () => {
      mockPrisma.charterer.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
