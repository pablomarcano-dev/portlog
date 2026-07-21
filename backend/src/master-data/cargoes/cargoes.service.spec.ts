import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CargoesService } from './cargoes.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockCargo = {
  id: 'cargo-cuid-1',
  name: 'Crude Oil',
  bblUnit: 'BBL',
  category: 'OT' as const,
  comments: null,
  label: 'Crude Oil',
};

const mockPrisma = {
  cargo: {
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

describe('CargoesService', () => {
  let service: CargoesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [CargoesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<CargoesService>(CargoesService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.cargo.findMany.mockResolvedValue([mockCargo]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Crude Oil');
      expect(result.hasMore).toBe(false);
    });

    it('applies the category filter to the where clause when provided', async () => {
      mockPrisma.cargo.findMany.mockResolvedValue([mockCargo]);

      await service.list({ q: undefined, limit: 50, cursor: undefined, category: 'OT' });

      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: 'OT' }) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------
  describe('search', () => {
    it('filters by category and returns it on each result', async () => {
      mockPrisma.cargo.findMany.mockResolvedValue([
        { id: 'cargo-cuid-1', name: 'Crude Oil', category: 'OT' },
      ]);

      const result = await service.search('Crude', 'OT');

      expect(mockPrisma.cargo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ category: 'OT' }) }),
      );
      expect(result[0]).toEqual({ id: 'cargo-cuid-1', label: 'Crude Oil', category: 'OT' });
    });

    it('omits the category filter when none is given', async () => {
      mockPrisma.cargo.findMany.mockResolvedValue([]);

      await service.search('Crude');

      const call = mockPrisma.cargo.findMany.mock.calls[0]?.[0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).not.toHaveProperty('category');
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the cargo when found', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(mockCargo);

      const result = await service.getById('cargo-cuid-1');

      expect(result.name).toBe('Crude Oil');
    });

    it('throws NotFoundException when cargo does not exist', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new cargo', async () => {
      mockPrisma.cargo.create.mockResolvedValue(mockCargo);

      const result = await service.create({ name: 'Crude Oil', bblUnit: 'BBL' });

      expect(result.name).toBe('Crude Oil');
      expect(result.bblUnit).toBe('BBL');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.cargo.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Crude Oil', bblUnit: 'BBL' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the cargo', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(mockCargo);
      mockPrisma.cargo.update.mockResolvedValue({ ...mockCargo, bblUnit: 'MT' });

      const result = await service.update('cargo-cuid-1', { bblUnit: 'MT' });

      expect(result.bblUnit).toBe('MT');
    });

    it('throws NotFoundException when cargo does not exist', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the cargo successfully', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(mockCargo);
      mockPrisma.cargo.delete.mockResolvedValue(mockCargo);

      await expect(service.remove('cargo-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when cargo does not exist', async () => {
      mockPrisma.cargo.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
