import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ShipParticularsService } from './ship-particulars.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockShip = {
  id: 'ship-cuid-1',
  callSign: 'ABCD1',
  name: 'MV Test Vessel',
  abbreviation: 'MTV',
  loa: null,
  dwt: null,
  grt: null,
  nrt: null,
  email: null,
  imoNumber: '1234567',
  phone: null,
  phone2: null,
  fax: null,
  flagId: 'flag-cuid-1',
  ownerId: null,
  operatorId: null,
  comments: null,
  label: 'MV Test Vessel',
};

const mockPrisma = {
  shipParticular: {
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

describe('ShipParticularsService', () => {
  let service: ShipParticularsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShipParticularsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ShipParticularsService>(ShipParticularsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.shipParticular.findMany.mockResolvedValue([mockShip]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('MV Test Vessel');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new ship particular', async () => {
      mockPrisma.shipParticular.create.mockResolvedValue(mockShip);

      const result = await service.create({
        name: 'MV Test Vessel',
        callSign: 'ABCD1',
        flagId: 'flag-cuid-1',
        imoNumber: '1234567',
      });

      expect(result.name).toBe('MV Test Vessel');
      expect(result.imoNumber).toBe('1234567');
    });

    it('throws ConflictException with field name on P2002 imoNumber collision', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['imoNumber'] },
      });
      mockPrisma.shipParticular.create.mockRejectedValue(prismaError);

      await expect(
        service.create({ name: 'Dup', callSign: 'XYZ12', flagId: 'flag-1', imoNumber: '1234567' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on P2002 callSign collision', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '5.0.0',
        meta: { target: ['callSign'] },
      });
      mockPrisma.shipParticular.create.mockRejectedValue(prismaError);

      await expect(
        service.create({ name: 'Dup', callSign: 'ABCD1', flagId: 'flag-1' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException on P2003 FK violation', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError('Foreign key constraint', {
        code: 'P2003',
        clientVersion: '5.0.0',
        meta: { field_name: 'flagId' },
      });
      mockPrisma.shipParticular.create.mockRejectedValue(prismaError);

      await expect(
        service.create({ name: 'Bad FK', callSign: 'ZZZZ1', flagId: 'nonexistent-flag' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the ship particular when found', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(mockShip);

      const result = await service.getById('ship-cuid-1');

      expect(result.name).toBe('MV Test Vessel');
    });

    it('throws NotFoundException when ship particular does not exist', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the ship particular', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(mockShip);
      mockPrisma.shipParticular.update.mockResolvedValue({ ...mockShip, name: 'MV Updated' });

      const result = await service.update('ship-cuid-1', { name: 'MV Updated' });

      expect(result.name).toBe('MV Updated');
    });

    it('throws NotFoundException when ship particular does not exist', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the ship particular successfully', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(mockShip);
      mockPrisma.shipParticular.delete.mockResolvedValue(mockShip);

      await expect(service.remove('ship-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when ship particular does not exist', async () => {
      mockPrisma.shipParticular.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
