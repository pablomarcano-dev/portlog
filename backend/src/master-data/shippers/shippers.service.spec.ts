import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ShippersService } from './shippers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockShipper = {
  id: 'shipper-cuid-1',
  name: 'Acme Shipping Co',
  email: 'acme@example.com',
  businessPhone: '+1 555 0100',
  businessFax: '+1 555 0101',
  address: '123 Port Road',
  comments: null,
  label: 'Acme Shipping Co',
};

const mockPrisma = {
  shipper: {
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

describe('ShippersService', () => {
  let service: ShippersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ShippersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ShippersService>(ShippersService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.shipper.findMany.mockResolvedValue([mockShipper]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Acme Shipping Co');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the shipper when found', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(mockShipper);

      const result = await service.getById('shipper-cuid-1');

      expect(result.name).toBe('Acme Shipping Co');
    });

    it('throws NotFoundException when shipper does not exist', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new shipper', async () => {
      mockPrisma.shipper.create.mockResolvedValue(mockShipper);

      const result = await service.create({ name: 'Acme Shipping Co' });

      expect(result.name).toBe('Acme Shipping Co');
    });

    it('throws ConflictException on Prisma P2002 unique violation', async () => {
      mockPrisma.shipper.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Acme Shipping Co' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the shipper', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(mockShipper);
      mockPrisma.shipper.update.mockResolvedValue({ ...mockShipper, address: '456 New St' });

      const result = await service.update('shipper-cuid-1', { address: '456 New St' });

      expect(result.address).toBe('456 New St');
    });

    it('throws NotFoundException when shipper does not exist', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the shipper successfully', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(mockShipper);
      mockPrisma.shipper.delete.mockResolvedValue(mockShipper);

      await expect(service.remove('shipper-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when shipper does not exist', async () => {
      mockPrisma.shipper.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
