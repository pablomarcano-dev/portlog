import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PortsService } from './ports.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';

// ---------------------------------------------------------------------------
// Minimal Prisma mock
// ---------------------------------------------------------------------------

const mockPort = {
  id: 'port-cuid-1',
  name: 'Rotterdam',
  abbreviation: 'RTM',
  location: 'Netherlands',
  parentId: null,
  comments: null,
};

const mockChild = {
  id: 'port-cuid-2',
  name: 'Maasvlakte Terminal',
  abbreviation: 'MVT',
  location: null,
  parentId: 'port-cuid-1',
  comments: null,
};

const mockGrandchild = {
  id: 'port-cuid-3',
  name: 'Berth 42',
  abbreviation: null,
  location: null,
  parentId: 'port-cuid-2',
  comments: null,
};

const mockPrisma = {
  port: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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
    it('returns top-level ports when parentId is null', async () => {
      mockPrisma.port.findMany.mockResolvedValue([mockPort]);

      const result = await service.list({
        q: undefined,
        limit: 50,
        cursor: undefined,
        parentId: null,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Rotterdam');
      expect(result.hasMore).toBe(false);
    });

    it('returns children when parentId is provided', async () => {
      mockPrisma.port.findMany.mockResolvedValue([mockChild]);

      const result = await service.list({
        q: undefined,
        limit: 50,
        cursor: undefined,
        parentId: 'port-cuid-1',
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.name).toBe('Maasvlakte Terminal');
    });
  });

  // -------------------------------------------------------------------------
  // getById
  // -------------------------------------------------------------------------
  describe('getById', () => {
    it('returns port with parent and children', async () => {
      mockPrisma.port.findUnique.mockResolvedValue({
        ...mockPort,
        parent: null,
        children: [
          { id: mockChild.id, name: mockChild.name, abbreviation: mockChild.abbreviation },
        ],
      });

      const result = await service.getById('port-cuid-1');

      expect(result.name).toBe('Rotterdam');
      expect(result.children).toHaveLength(1);
      expect(result.parent).toBeNull();
    });

    it('throws NotFoundException when port does not exist', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(null);

      await expect(service.getById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('creates top-level port without parentId', async () => {
      mockPrisma.port.create.mockResolvedValue(mockPort);

      const result = await service.create({ name: 'Rotterdam' });

      expect(result.name).toBe('Rotterdam');
    });

    it('creates child port when parentId is valid and depth is allowed', async () => {
      // assertParentExists → findUnique returns the parent
      mockPrisma.port.findUnique
        .mockResolvedValueOnce({ id: mockPort.id }) // parent exists
        .mockResolvedValueOnce({ parentId: null }); // parent's parent is null → depth 1
      mockPrisma.port.create.mockResolvedValue(mockChild);

      const result = await service.create({ name: 'Maasvlakte Terminal', parentId: mockPort.id });

      expect(result.parentId).toBe('port-cuid-1');
    });

    it('throws BadRequestException when depth would exceed 3 levels', async () => {
      // Parent exists
      mockPrisma.port.findUnique
        .mockResolvedValueOnce({ id: mockChild.id }) // parent exists check
        // depth walk: child → grandparent → root (3 hops = depth would be 4)
        .mockResolvedValueOnce({ parentId: mockPort.id }) // mockChild's parent
        .mockResolvedValueOnce({ parentId: null }); // mockPort has no parent

      await expect(service.create({ name: 'Too Deep', parentId: mockChild.id })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // update — cycle prevention
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('rejects self-reference as parent', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(mockPort);

      await expect(service.update('port-cuid-1', { parentId: 'port-cuid-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects moving a node under one of its descendants', async () => {
      // assertExists
      mockPrisma.port.findUnique.mockResolvedValue(mockPort);

      // assertNoCycle: descendants of port-cuid-1 include port-cuid-2
      mockPrisma.port.findMany
        .mockResolvedValueOnce([{ id: mockChild.id }]) // children of port-cuid-1
        .mockResolvedValueOnce([]); // children of port-cuid-2

      // targetParentId = port-cuid-2 which is a descendant → cycle
      await expect(service.update('port-cuid-1', { parentId: 'port-cuid-2' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('updates port name successfully', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(mockPort);
      mockPrisma.port.update.mockResolvedValue({ ...mockPort, name: 'Rotterdam Updated' });

      const result = await service.update('port-cuid-1', { name: 'Rotterdam Updated' });

      expect(result.name).toBe('Rotterdam Updated');
    });
  });

  // -------------------------------------------------------------------------
  // remove
  // -------------------------------------------------------------------------
  describe('remove', () => {
    it('deletes port when it has no children', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(mockPort);
      mockPrisma.port.count.mockResolvedValue(0);
      mockPrisma.port.delete.mockResolvedValue(mockPort);

      await expect(service.remove('port-cuid-1')).resolves.toBeUndefined();
    });

    it('throws ConflictException (409) when port has children', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(mockPort);
      mockPrisma.port.count.mockResolvedValue(2);

      await expect(service.remove('port-cuid-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when port does not exist', async () => {
      mockPrisma.port.findUnique.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // getTree
  // -------------------------------------------------------------------------
  describe('getTree', () => {
    it('returns the hierarchy as nested roots', async () => {
      mockPrisma.port.findMany.mockResolvedValue([mockPort, mockChild, mockGrandchild]);

      const result = await service.getTree();

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Rotterdam');
      expect(result[0]?.children).toHaveLength(1);
      expect(result[0]?.children[0]?.name).toBe('Maasvlakte Terminal');
      expect(result[0]?.children[0]?.children).toHaveLength(1);
    });

    it('returns empty array when no ports exist', async () => {
      mockPrisma.port.findMany.mockResolvedValue([]);

      const result = await service.getTree();

      expect(result).toHaveLength(0);
    });
  });
});
