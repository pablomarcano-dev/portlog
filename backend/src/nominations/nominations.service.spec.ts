import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { NominationsService } from './nominations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
  berthPortId: null,
  berthPort: null,
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
  features: [],
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
  $transaction: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NominationsService', () => {
  let service: NominationsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [NominationsService, { provide: PrismaService, useValue: mockPrisma }],
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
          voyageNumber: '01/PLC',
          dateNominated: NOW,
          nominationType: 'FULL_AGENCY',
          features: [],
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
});
