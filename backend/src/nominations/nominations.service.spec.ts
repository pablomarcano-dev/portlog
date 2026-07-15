import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { NominationsService } from './nominations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date('2026-01-15T12:00:00Z');
const USER_ID = 'cluser0000000001';
const NOM_ID = '00000000-0000-0000-0000-000000000001';

const mockNomBase = {
  id: NOM_ID,
  correlative: 1,
  voyageNumber: '01/PLC',
  voyageCode: null,
  shipParticularId: 'clship0000000001',
  shipParticular: {
    id: 'clship0000000001',
    name: 'MV Test',
    callSign: 'TEST',
    imoNumber: null,
    abbreviation: null,
  },
  operatorId: null,
  operator: null,
  operatorVariant: null,
  operatorContactId: null,
  charterId: null,
  charter: null,
  charterVariant: null,
  charterContactId: null,
  ownerId: null,
  owner: null,
  ownerVariant: null,
  ownerContactId: null,
  shipperId: null,
  shipper: null,
  shipperVariant: null,
  shipperContactId: null,
  contactBlackBerry: null,
  blindCopy: null,
  opPortId: null,
  opPort: null,
  pierId: null,
  pier: null,
  lastPortId: null,
  lastPort: null,
  nextPortId: null,
  nextPort: null,
  disPortId: null,
  disPort: null,
  dateNominated: NOW,
  layDaysFirst: null,
  layDaysLast: null,
  etaDate: null,
  nominatedById: null,
  nominatedBy: null,
  master: null,
  mic: null,
  broker: null,
  boardingClerk: null,
  inspector: null,
  nominationType: 'FULL_AGENCY' as const,
  subject: null,
  parcels: [],
  status: 'DRAFT' as const,
  statusHistory: [],
  createdById: USER_ID,
  createdBy: { id: USER_ID, email: 'ops@portlog.com' },
  createdAt: NOW,
  updatedAt: NOW,
};

// ---------------------------------------------------------------------------
// Prisma mock
// ---------------------------------------------------------------------------

const mockPrisma = {
  nomination: {
    create: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  nominationStatusHistory: {
    create: jest.fn(),
  },
  sale: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

// No spec exercises email paths — an empty mock satisfies DI.
const mockEmailService = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NominationsService', () => {
  let service: NominationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NominationsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<NominationsService>(NominationsService);
  });

  // -------------------------------------------------------------------------
  // 1. create — happy path
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('returns nomination with snOt and initial DRAFT history row', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.create.mockResolvedValue(mockNomBase);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          return fn(mockPrisma);
        },
      );

      const result = await service.create(
        {
          shipParticularId: 'clship0000000001',
          branchId: 'clbranch000000001',
          voyageNumber: '01/PLC',
          dateNominated: NOW,
          nominationType: 'FULL_AGENCY',
          parcels: [],
        },
        USER_ID,
      );

      expect(result.snOt).toBe('SN-26/0001');
      expect(result.correlative).toBe(1);
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'DRAFT' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. update — terminal status blocks edit
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('throws ConflictException when nomination is COMPLETED', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID, status: 'COMPLETED' });

      await expect(service.update(NOM_ID, { voyageNumber: 'NEW' }, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws ConflictException when nomination is CANCELLED', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID, status: 'CANCELLED' });

      await expect(service.update(NOM_ID, { voyageNumber: 'NEW' }, USER_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when nomination does not exist', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(null);

      await expect(service.update(NOM_ID, { voyageNumber: 'NEW' }, USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 3. transition — invalid transition throws BadRequest
  // -------------------------------------------------------------------------
  describe('transition', () => {
    it('throws BadRequestException for invalid transition DRAFT → COMPLETED', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({
        id: NOM_ID,
        status: 'DRAFT',
        correlative: 1,
      });

      await expect(service.transition(NOM_ID, { toStatus: 'COMPLETED' }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for DRAFT → CANCELLED without reason', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({
        id: NOM_ID,
        status: 'DRAFT',
        correlative: 1,
      });

      await expect(service.transition(NOM_ID, { toStatus: 'CANCELLED' }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('succeeds for IN_PROGRESS → COMPLETED and writes one history row', async () => {
      const completedNom = { ...mockNomBase, status: 'COMPLETED' as const };

      mockPrisma.nomination.findUnique.mockResolvedValue({
        id: NOM_ID,
        status: 'IN_PROGRESS',
        correlative: 1,
      });
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.update.mockResolvedValue(completedNom);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          return fn(mockPrisma);
        },
      );

      const result = await service.transition(NOM_ID, { toStatus: 'COMPLETED' }, USER_ID);

      expect((result as { status: string }).status).toBe('COMPLETED');
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: 'IN_PROGRESS', toStatus: 'COMPLETED' }),
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4. delete — always throws MethodNotAllowed
  // -------------------------------------------------------------------------
  describe('delete', () => {
    it('throws MethodNotAllowedException', () => {
      expect(() => service.delete()).toThrow(MethodNotAllowedException);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Sale sub-resource CRUD
  // -------------------------------------------------------------------------
  const SALE_ID = '00000000-0000-0000-0000-000000000101';
  const SALE_CREATE = {
    clientId: 'clclient00000001',
    serviceId: 'clservice0000001',
    price: 1500.5,
    date: NOW,
    notes: null,
  };
  const mockSale = {
    id: SALE_ID,
    nominationId: NOM_ID,
    ...SALE_CREATE,
    client: { id: SALE_CREATE.clientId, name: 'Acme Shipping S.A.' },
    service: { id: SALE_CREATE.serviceId, name: 'Launch / Boat Service' },
    createdAt: NOW,
    updatedAt: NOW,
  };

  describe('listSales', () => {
    it('throws NotFoundException for an unknown nomination', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(null);

      await expect(service.listSales(NOM_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns sales with client/service includes ordered by date', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID });
      mockPrisma.sale.findMany.mockResolvedValue([mockSale]);

      const result = await service.listSales(NOM_ID);

      expect(result).toEqual([mockSale]);
      expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nominationId: NOM_ID },
          orderBy: { date: 'asc' },
        }),
      );
    });
  });

  describe('addSale', () => {
    it('spreads nominationId into the created row', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID });
      mockPrisma.sale.create.mockResolvedValue(mockSale);

      const result = await service.addSale(NOM_ID, SALE_CREATE);

      expect(result).toEqual(mockSale);
      expect(mockPrisma.sale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ...SALE_CREATE, nominationId: NOM_ID }),
        }),
      );
    });

    it('throws NotFoundException for an unknown nomination', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(null);

      await expect(service.addSale(NOM_ID, SALE_CREATE)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sale.create).not.toHaveBeenCalled();
    });
  });

  describe('updateSale', () => {
    it('throws NotFoundException when the sale is not on the nomination', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(null);

      await expect(service.updateSale(NOM_ID, SALE_ID, { price: 2000 })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrisma.sale.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SALE_ID, nominationId: NOM_ID } }),
      );
      expect(mockPrisma.sale.update).not.toHaveBeenCalled();
    });

    it('updates the sale when it exists', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({ id: SALE_ID });
      mockPrisma.sale.update.mockResolvedValue({ ...mockSale, price: 2000 });

      const result = await service.updateSale(NOM_ID, SALE_ID, { price: 2000 });

      expect((result as { price: number }).price).toBe(2000);
      expect(mockPrisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SALE_ID }, data: { price: 2000 } }),
      );
    });
  });

  describe('removeSale', () => {
    it('throws NotFoundException when the sale is not on the nomination', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(null);

      await expect(service.removeSale(NOM_ID, SALE_ID)).rejects.toThrow(NotFoundException);
      expect(mockPrisma.sale.delete).not.toHaveBeenCalled();
    });

    it('deletes the sale when it exists', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue({ id: SALE_ID });
      mockPrisma.sale.delete.mockResolvedValue(mockSale);

      await service.removeSale(NOM_ID, SALE_ID);

      expect(mockPrisma.sale.delete).toHaveBeenCalledWith({ where: { id: SALE_ID } });
    });
  });
});
