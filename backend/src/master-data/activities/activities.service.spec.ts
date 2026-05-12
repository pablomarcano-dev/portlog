import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockActivity = {
  id: 'activity-cuid-1',
  name: 'Loading',
  comments: null,
  label: 'Loading',
};

const mockPrisma = {
  activity: {
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

describe('ActivitiesService', () => {
  let service: ActivitiesService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ActivitiesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ActivitiesService>(ActivitiesService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.activity.findMany.mockResolvedValue([mockActivity]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Loading');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the activity when found', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(mockActivity);

      const result = await service.getById('activity-cuid-1');

      expect(result.name).toBe('Loading');
    });

    it('throws NotFoundException when activity does not exist', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new activity', async () => {
      mockPrisma.activity.create.mockResolvedValue(mockActivity);

      const result = await service.create({ name: 'Loading' });

      expect(result.name).toBe('Loading');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.activity.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Loading' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the activity', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrisma.activity.update.mockResolvedValue({ ...mockActivity, name: 'Discharging' });

      const result = await service.update('activity-cuid-1', { name: 'Discharging' });

      expect(result.name).toBe('Discharging');
    });

    it('throws NotFoundException when activity does not exist', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the activity successfully', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(mockActivity);
      mockPrisma.activity.delete.mockResolvedValue(mockActivity);

      await expect(service.remove('activity-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when activity does not exist', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
