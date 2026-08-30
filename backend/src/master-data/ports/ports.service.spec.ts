import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PortsService } from './ports.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
//
// This spec was originally written (POR-33, commit 9df9ddf) against a self-referencing
// country → port → terminal hierarchy on Port: a parentId column, a depth limit of 3, and
// getTree(). Commit 6cdfb37 replaced that design with a flat Port plus a separate Pier child
// table, but the spec was never updated, so six of its cases exercised methods the service no
// longer has and failed on every run. Rewritten here against the service as it actually is.
// Do not reintroduce parentId assertions — terminals and berths are Pier rows now.
// ---------------------------------------------------------------------------

const mockPort = {
  id: 'port-cuid-1',
  name: 'Montevideo',
  abbreviation: 'MVD',
  country: 'Uruguay',
  emailGroup: null,
  comments: null,
};

const mockPrisma = {
  port: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

const uniqueViolation = { code: 'P2002' };

describe('PortsService', () => {
  let service: PortsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PortsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<PortsService>(PortsService);
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------
  describe('list', () => {
    it('returns a single page and reports no more results', async () => {
      mockPrisma.port.findMany.mockResolvedValue([mockPort]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Montevideo');
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeNull();
    });

    it('adds a label alias so the list feeds the shared picker components', async () => {
      mockPrisma.port.findMany.mockResolvedValue([mockPort]);

      const result = await service.list({ q: undefined, limit: 50, cursor: undefined });

      expect(result.items[0]?.label).toBe('Montevideo');
    });

    it('trims the extra row and returns a cursor when more results exist', async () => {
      // The service over-fetches by one to detect a further page.
      mockPrisma.port.findMany.mockResolvedValue([
        mockPort,
        { ...mockPort, id: 'port-cuid-2', name: 'Nueva Palmira' },
      ]);

      const result = await service.list({ q: undefined, limit: 1, cursor: undefined });

      expect(result.items).toHaveLength(1);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe('port-cuid-1');
    });

    it('filters by name case-insensitively when q is given', async () => {
      mockPrisma.port.findMany.mockResolvedValue([]);

      await service.list({ q: 'monte', limit: 50, cursor: undefined });

      expect(mockPrisma.port.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: { contains: 'monte', mode: 'insensitive' } },
        }),
      );
    });

    it('filters operating ports by branch when branchId is supplied', async () => {
      mockPrisma.port.findMany.mockResolvedValue([]);

      await service.list({ q: undefined, limit: 50, cursor: undefined, branchId: 'branch-1' });

      expect(mockPrisma.port.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { branchId: 'branch-1' } }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns the port with its piers', async () => {
      mockPrisma.port.findUnique.mockResolvedValue({
        ...mockPort,
        piers: [{ id: 'pier-1', name: 'Berth 3' }],
      });

      const result = await service.getById('port-cuid-1');

      expect(result.name).toBe('Montevideo');
      expect(result.piers).toHaveLength(1);
      expect(result.piers[0]?.name).toBe('Berth 3');
    });

    it('throws NotFoundException when the port does not exist', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(null);

      await expect(service.getById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates a port', async () => {
      mockPrisma.port.create.mockResolvedValue(mockPort);

      const result = await service.create({ name: 'Montevideo', country: 'Uruguay' });

      expect(result.name).toBe('Montevideo');
    });

    it('surfaces a duplicate name as ConflictException, not a raw Prisma error', async () => {
      mockPrisma.port.create.mockRejectedValue(uniqueViolation);

      await expect(service.create({ name: 'Montevideo' })).rejects.toThrow(ConflictException);
    });
  });

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('updates a port that exists', async () => {
      mockPrisma.port.findUnique.mockResolvedValue({ id: 'port-cuid-1' });
      mockPrisma.port.update.mockResolvedValue({ ...mockPort, name: 'Montevideo Puerto' });

      const result = await service.update('port-cuid-1', { name: 'Montevideo Puerto' });

      expect(result.name).toBe('Montevideo Puerto');
    });

    it('throws NotFoundException before attempting the update', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(null);

      await expect(service.update('missing', { name: 'x' })).rejects.toThrow(NotFoundException);
      expect(mockPrisma.port.update).not.toHaveBeenCalled();
    });

    it('surfaces a duplicate name as ConflictException', async () => {
      mockPrisma.port.findUnique.mockResolvedValue({ id: 'port-cuid-1' });
      mockPrisma.port.update.mockRejectedValue(uniqueViolation);

      await expect(service.update('port-cuid-1', { name: 'Taken' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // remove
  //
  // Note: piers are removed with the port by `onDelete: Cascade` on Pier.portId — the service
  // does not guard against a port still having piers.
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes the port', async () => {
      mockPrisma.port.findUnique.mockResolvedValue({ id: 'port-cuid-1' });
      mockPrisma.port.delete.mockResolvedValue(mockPort);

      await service.remove('port-cuid-1');

      expect(mockPrisma.port.delete).toHaveBeenCalledWith({ where: { id: 'port-cuid-1' } });
    });

    it('throws NotFoundException when the port does not exist', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.port.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // countries — backs the country filter on the ports screen
  // -------------------------------------------------------------------------
  describe('countries', () => {
    it('returns the distinct country values', async () => {
      mockPrisma.port.findMany.mockResolvedValue([
        { country: 'Argentina' },
        { country: 'Uruguay' },
      ]);

      await expect(service.countries()).resolves.toEqual(['Argentina', 'Uruguay']);
    });

    it('drops null and whitespace-only countries so the filter has no blank option', async () => {
      mockPrisma.port.findMany.mockResolvedValue([
        { country: 'Uruguay' },
        { country: null },
        { country: '   ' },
      ]);

      await expect(service.countries()).resolves.toEqual(['Uruguay']);
    });
  });

  // -------------------------------------------------------------------------
  // search
  // -------------------------------------------------------------------------
  describe('search', () => {
    it('returns id/label pairs for the type-ahead', async () => {
      mockPrisma.port.findMany.mockResolvedValue([{ id: 'port-cuid-1', name: 'Montevideo' }]);

      await expect(service.search('mont')).resolves.toEqual([
        { id: 'port-cuid-1', label: 'Montevideo' },
      ]);
    });
  });
});
