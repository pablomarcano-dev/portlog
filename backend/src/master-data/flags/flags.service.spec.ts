import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FlagsService } from './flags.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockFlag = {
  id: 'flag-cuid-1',
  name: 'Panama',
  abbreviation: 'PA',
  comments: null,
  label: 'Panama',
};

const mockPrisma = {
  flag: {
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

describe('FlagsService', () => {
  let service: FlagsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [FlagsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<FlagsService>(FlagsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items and no nextCursor when results fit in one page', async () => {
      mockPrisma.flag.findMany.mockResolvedValue([mockFlag]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Panama');
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('sets hasMore and nextCursor when results exceed limit', async () => {
      // Return limit+1 rows to trigger pagination
      const manyFlags = Array.from({ length: 51 }, (_, i) => ({
        id: `flag-${i}`,
        name: `Flag ${i}`,
        abbreviation: null,
        comments: null,
        label: `Flag ${i}`,
      }));
      mockPrisma.flag.findMany.mockResolvedValue(manyFlags);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(50);
      expect(result.nextCursor).toBe('flag-49');
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the flag when found', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(mockFlag);

      const result = await service.getById('flag-cuid-1');

      expect(result.name).toBe('Panama');
    });

    it('throws NotFoundException when flag does not exist', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new flag', async () => {
      mockPrisma.flag.create.mockResolvedValue(mockFlag);

      const result = await service.create({ name: 'Panama', abbreviation: 'PA' });

      expect(result.name).toBe('Panama');
      expect(mockPrisma.flag.create).toHaveBeenCalledTimes(1);
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.flag.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Panama' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the flag', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(mockFlag);
      mockPrisma.flag.update.mockResolvedValue({ ...mockFlag, abbreviation: 'PAN' });

      const result = await service.update('flag-cuid-1', { abbreviation: 'PAN' });

      expect(result.abbreviation).toBe('PAN');
    });

    it('throws NotFoundException when flag does not exist', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the flag successfully', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(mockFlag);
      mockPrisma.flag.delete.mockResolvedValue(mockFlag);

      await expect(service.remove('flag-cuid-1')).resolves.toBeUndefined();
      expect(mockPrisma.flag.delete).toHaveBeenCalledWith({ where: { id: 'flag-cuid-1' } });
    });

    it('throws NotFoundException when flag does not exist', async () => {
      mockPrisma.flag.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
