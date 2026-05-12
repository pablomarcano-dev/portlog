import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockSupplier = {
  id: 'supplier-cuid-1',
  name: 'Acme Suppliers S.A.',
  contactos: null,
  direccion: 'Calle Puerto 123',
  servicios: 'Stevedoring, pilotage',
  kyc: null,
  telefonos: '+1 555 0200',
  correosElectronicos: null,
  certificados: null,
  tarifas: null,
  contratoDeServicios: null,
  acuerdos: null,
  comments: null,
  label: 'Acme Suppliers S.A.',
};

const mockPrisma = {
  supplier: {
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

describe('SuppliersService', () => {
  let service: SuppliersService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.supplier.findMany.mockResolvedValue([mockSupplier]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Acme Suppliers S.A.');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the supplier when found', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);

      const result = await service.getById('supplier-cuid-1');

      expect(result.name).toBe('Acme Suppliers S.A.');
    });

    it('throws NotFoundException when supplier does not exist', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new supplier', async () => {
      mockPrisma.supplier.create.mockResolvedValue(mockSupplier);

      const result = await service.create({ name: 'Acme Suppliers S.A.' });

      expect(result.name).toBe('Acme Suppliers S.A.');
    });

    it('throws ConflictException on Prisma P2002 unique violation (name conflict)', async () => {
      mockPrisma.supplier.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.create({ name: 'Acme Suppliers S.A.' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the supplier', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.supplier.update.mockResolvedValue({
        ...mockSupplier,
        direccion: 'Avenida Nueva 456',
      });

      const result = await service.update('supplier-cuid-1', { direccion: 'Avenida Nueva 456' });

      expect(result.direccion).toBe('Avenida Nueva 456');
    });

    it('throws NotFoundException when supplier does not exist', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the supplier successfully', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(mockSupplier);
      mockPrisma.supplier.delete.mockResolvedValue(mockSupplier);

      await expect(service.remove('supplier-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when supplier does not exist', async () => {
      mockPrisma.supplier.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
