import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockContact = {
  id: 'contact-cuid-1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  homePhone: null,
  mobile: null,
  businessPhone: '+1 555 0100',
  businessFax: null,
  address: '123 Port Road',
  shipperId: null,
  operatorId: null,
  ownerId: null,
  charterId: null,
  comments: null,
};

const mockPrisma = {
  contact: {
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

describe('ContactsService', () => {
  let service: ContactsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  // -------------------------------------------------------------------------
  // assertSingleOwner — the three required spec cases
  // -------------------------------------------------------------------------
  describe('assertSingleOwner guard', () => {
    it('(1) rejects a double-linked payload with BadRequestException', async () => {
      // Two non-null FKs — must be rejected before hitting DB
      await expect(
        service.create({
          name: 'Jane Doe',
          shipperId: 'shipper-cuid-1',
          charterId: 'charter-cuid-1',
        }),
      ).rejects.toThrow(BadRequestException);

      // Prisma create must NOT have been called
      expect(mockPrisma.contact.create).not.toHaveBeenCalled();
    });

    it('(2) accepts a single-linked payload', async () => {
      mockPrisma.contact.create.mockResolvedValue({
        ...mockContact,
        shipperId: 'shipper-cuid-1',
      });

      const result = await service.create({
        name: 'Jane Doe',
        shipperId: 'shipper-cuid-1',
      });

      expect(result.shipperId).toBe('shipper-cuid-1');
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(1);
    });

    it('(3) accepts a zero-linked payload (orphan contact)', async () => {
      mockPrisma.contact.create.mockResolvedValue(mockContact);

      const result = await service.create({ name: 'Jane Doe' });

      expect(result.shipperId).toBeNull();
      expect(result.operatorId).toBeNull();
      expect(result.ownerId).toBeNull();
      expect(result.charterId).toBeNull();
      expect(mockPrisma.contact.create).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns items when results fit in one page', async () => {
      mockPrisma.contact.findMany.mockResolvedValue([mockContact]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Jane Doe');
      expect(result.hasMore).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the contact when found', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(mockContact);

      const result = await service.getById('contact-cuid-1');

      expect(result.name).toBe('Jane Doe');
    });

    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates and returns the contact', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(mockContact);
      mockPrisma.contact.update.mockResolvedValue({ ...mockContact, address: '456 New St' });

      const result = await service.update('contact-cuid-1', { address: '456 New St' });

      expect(result.address).toBe('456 New St');
    });

    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.update('nonexistent', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('rejects update with multiple FKs', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(mockContact);

      await expect(
        service.update('contact-cuid-1', {
          shipperId: 'shipper-cuid-1',
          operatorId: 'operator-cuid-1',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(mockPrisma.contact.update).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the contact successfully', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(mockContact);
      mockPrisma.contact.delete.mockResolvedValue(mockContact);

      await expect(service.remove('contact-cuid-1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when contact does not exist', async () => {
      mockPrisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });
});
