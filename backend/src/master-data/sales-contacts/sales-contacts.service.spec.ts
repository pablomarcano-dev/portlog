import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SalesContactsService } from './sales-contacts.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockContact = {
  id: 'clcontact0000001',
  name: 'J. Ramirez',
  phone: null,
  mobile: '+58 414 085 8517',
  documentNumber: 'V-12345678',
  vehicle: 'AB123CD',
  comments: null,
};

const mockPrisma = {
  salesContact: {
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

describe('SalesContactsService', () => {
  let service: SalesContactsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [SalesContactsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<SalesContactsService>(SalesContactsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items and no nextCursor when results fit in one page', async () => {
      mockPrisma.salesContact.findMany.mockResolvedValue([mockContact]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('J. Ramirez');
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('exposes a label so the shared EntityPicker can render it', async () => {
      mockPrisma.salesContact.findMany.mockResolvedValue([mockContact]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items[0]?.label).toBe('J. Ramirez');
    });

    it('sets hasMore and nextCursor when results exceed limit', async () => {
      const many = Array.from({ length: 51 }, (_, i) => ({
        ...mockContact,
        id: `contact-${i}`,
        name: `Contact ${i}`,
      }));
      mockPrisma.salesContact.findMany.mockResolvedValue(many);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.hasMore).toBe(true);
      expect(result.items).toHaveLength(50);
      expect(result.nextCursor).toBe('contact-49');
    });

    it('filters case-insensitively on name when q is given', async () => {
      mockPrisma.salesContact.findMany.mockResolvedValue([]);

      await service.list({ q: 'ramirez', limit: 50, cursor: undefined });

      expect(mockPrisma.salesContact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'ramirez', mode: 'insensitive' } },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the contact when found', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(mockContact);

      const result = await service.getById('clcontact0000001');

      expect(result.name).toBe('J. Ramirez');
    });

    it('throws NotFoundException when the contact does not exist', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates and returns the new contact', async () => {
      mockPrisma.salesContact.create.mockResolvedValue(mockContact);

      const result = await service.create({ name: 'J. Ramirez' });

      expect(result.name).toBe('J. Ramirez');
      expect(mockPrisma.salesContact.create).toHaveBeenCalledTimes(1);
    });

    // Namesakes are legitimate in a people directory, so there is deliberately
    // no unique index on name and no P2002 handling.
    it('allows a second contact with the same name', async () => {
      mockPrisma.salesContact.create.mockResolvedValue({ ...mockContact, id: 'clcontact0000002' });

      const result = await service.create({ name: 'J. Ramirez' });

      expect(result.id).toBe('clcontact0000002');
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the contact', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(mockContact);
      mockPrisma.salesContact.update.mockResolvedValue({ ...mockContact, vehicle: 'XY789ZZ' });

      const result = await service.update('clcontact0000001', { vehicle: 'XY789ZZ' });

      expect(result.vehicle).toBe('XY789ZZ');
    });

    it('throws NotFoundException when the contact does not exist', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the contact successfully', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(mockContact);
      mockPrisma.salesContact.delete.mockResolvedValue(mockContact);

      await expect(service.remove('clcontact0000001')).resolves.toBeUndefined();
      expect(mockPrisma.salesContact.delete).toHaveBeenCalledWith({
        where: { id: 'clcontact0000001' },
      });
    });

    it('throws NotFoundException when the contact does not exist', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });

    // sales.driverId / sales.userId are ON DELETE RESTRICT.
    it('throws ConflictException when the contact is still named on a sale', async () => {
      mockPrisma.salesContact.findUnique.mockResolvedValue(mockContact);
      mockPrisma.salesContact.delete.mockRejectedValue({ code: 'P2003' });

      await expect(service.remove('clcontact0000001')).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------
  describe('search', () => {
    it('maps results to { id, label } for type-ahead', async () => {
      mockPrisma.salesContact.findMany.mockResolvedValue([
        { id: mockContact.id, name: mockContact.name },
      ]);

      const result = await service.search('ram');

      expect(result).toEqual([{ id: 'clcontact0000001', label: 'J. Ramirez' }]);
    });
  });
});
