import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { OperatorsService } from './operators.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OperatorCreateSchema } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockOperator = {
  id: 'operator-cuid-1',
  name: 'Global Operators Ltd',
  email: 'ops@global.com',
  businessPhone: '+1 555 0200',
  businessFax: null,
  address: '10 Dock Street',
  standardRequirements: 'All vessels must provide NOR 24h in advance.',
  sendCopy: false,
  location: 'L',
  comments: null,
  label: 'Global Operators Ltd',
};

const mockPrisma = {
  operator: {
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

describe('OperatorsService', () => {
  let service: OperatorsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [OperatorsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<OperatorsService>(OperatorsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.operator.findMany.mockResolvedValue([mockOperator]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Global Operators Ltd');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the operator when found', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(mockOperator);

      const result = await service.getById('operator-cuid-1');

      expect(result.name).toBe('Global Operators Ltd');
    });

    it('throws NotFoundException when operator does not exist', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new operator', async () => {
      mockPrisma.operator.create.mockResolvedValue(mockOperator);

      const result = await service.create({ name: 'Global Operators Ltd' });

      expect(result.name).toBe('Global Operators Ltd');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.operator.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Global Operators Ltd' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the operator', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(mockOperator);
      mockPrisma.operator.update.mockResolvedValue({ ...mockOperator, address: '20 New Dock' });

      const result = await service.update('operator-cuid-1', { address: '20 New Dock' });

      expect(result.address).toBe('20 New Dock');
    });

    it('throws NotFoundException when operator does not exist', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the operator successfully', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(mockOperator);
      mockPrisma.operator.delete.mockResolvedValue(mockOperator);

      await expect(service.remove('operator-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when operator does not exist', async () => {
      mockPrisma.operator.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // location enum validation (via Zod schema — unit test at schema level)
  // -------------------------------------------------------------------------
  describe('location enum validation (OperatorCreateSchema)', () => {
    it('accepts location "L"', () => {
      const result = OperatorCreateSchema.safeParse({ name: 'Ops Co', location: 'L' });
      expect(result.success).toBe(true);
    });

    it('accepts location "E"', () => {
      const result = OperatorCreateSchema.safeParse({ name: 'Ops Co', location: 'E' });
      expect(result.success).toBe(true);
    });

    it('rejects invalid location value', () => {
      const result = OperatorCreateSchema.safeParse({ name: 'Ops Co', location: 'X' });
      expect(result.success).toBe(false);
      if (!result.success) {
        const locationError = result.error.issues.find((i) => i.path.includes('location'));
        expect(locationError).toBeDefined();
      }
    });

    it('accepts omitted location (optional field)', () => {
      const result = OperatorCreateSchema.safeParse({ name: 'Ops Co' });
      expect(result.success).toBe(true);
    });
  });
});
