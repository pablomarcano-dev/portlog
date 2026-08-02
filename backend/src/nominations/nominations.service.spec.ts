import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import {
  NominationsService,
  dedupeEmails,
  formatCargoQuantity,
  formatEtcStamp,
  formatLaydayRange,
} from './nominations.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { EmailTemplateService } from '../email-templates/email-template.service.js';

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
  kind: 'SN' as const,
  subject: null,
  parcels: [],
  status: 'NOMINATED' as const,
  statusHistory: [],
  createdById: USER_ID,
  createdBy: { id: USER_ID, email: 'ops@portlog.com' },
  createdAt: NOW,
  updatedAt: NOW,
  // Status facts include (no sent PREARRIVAL/SOF dispatches) → derives to NOMINATED.
  pedr: { emailDispatches: [] },
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
  pedr: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  pedrStageHistory: {
    create: jest.fn(),
  },
  cargo: {
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
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

// No spec exercises attachment paths — an empty mock satisfies DI.
const mockAttachmentsService = {};

// Template rendering is covered by email-template.service.spec.ts, which renders
// the real files; here the stub returns a fixed body so compose specs can assert
// on recipients and on the variables handed to the template.
const mockEmailTemplateService = {
  render: jest.fn(),
};

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
        { provide: AttachmentsService, useValue: mockAttachmentsService },
        { provide: EmailTemplateService, useValue: mockEmailTemplateService },
      ],
    }).compile();

    service = module.get<NominationsService>(NominationsService);
  });

  // -------------------------------------------------------------------------
  // 1. create — happy path
  // -------------------------------------------------------------------------
  describe('create', () => {
    it('returns nomination with snOt, initial NOMINATED history row, and auto-created PEDR', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.create.mockResolvedValue(mockNomBase);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          mockPrisma.pedr.create.mockResolvedValue({ id: 'clpedr0000000001' });
          mockPrisma.pedrStageHistory.create.mockResolvedValue({});
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
      expect(result.status).toBe('NOMINATED');
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: null, toStatus: 'NOMINATED' }),
        }),
      );
      expect(mockPrisma.pedr.create).toHaveBeenCalledTimes(1);
    });

    it('renders an OT- prefix and accepts an OT-category product', async () => {
      const otNom = {
        ...mockNomBase,
        correlative: 8,
        kind: 'OT' as const,
        parcels: [{ product: 'Combustible', quantity: 100, unit: 'BBL', operation: 'Load' }],
      };
      mockPrisma.cargo.findMany.mockResolvedValue([{ name: 'Combustible' }]);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.create.mockResolvedValue(otNom);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          mockPrisma.pedr.create.mockResolvedValue({ id: 'clpedr0000000001' });
          mockPrisma.pedrStageHistory.create.mockResolvedValue({});
          return fn(mockPrisma);
        },
      );

      const result = await service.create(
        {
          shipParticularId: 'clship0000000001',
          branchId: 'clbranch000000001',
          dateNominated: NOW,
          nominationType: 'FULL_AGENCY',
          kind: 'OT',
          parcels: [{ product: 'Combustible', quantity: 100, unit: 'BBL', operation: 'Load' }],
        },
        USER_ID,
      );

      expect(result.snOt).toBe('OT-26/0008');
      expect(result.kind).toBe('OT');
      expect(mockPrisma.nomination.create).toHaveBeenCalledTimes(1);
    });

    it('rejects an OT nomination carrying a non-OT product with BadRequest', async () => {
      // No OT cargo matches the parcel product → validation fails before insert.
      mockPrisma.cargo.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );

      await expect(
        service.create(
          {
            shipParticularId: 'clship0000000001',
            branchId: 'clbranch000000001',
            dateNominated: NOW,
            nominationType: 'FULL_AGENCY',
            kind: 'OT',
            parcels: [{ product: 'Soja', quantity: 100, unit: 'MT', operation: 'Load' }],
          },
          USER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.nomination.create).not.toHaveBeenCalled();
    });

    it('does not query the product catalog for SN nominations', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.create.mockResolvedValue(mockNomBase);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          mockPrisma.pedr.create.mockResolvedValue({ id: 'clpedr0000000001' });
          mockPrisma.pedrStageHistory.create.mockResolvedValue({});
          return fn(mockPrisma);
        },
      );

      await service.create(
        {
          shipParticularId: 'clship0000000001',
          branchId: 'clbranch000000001',
          dateNominated: NOW,
          nominationType: 'FULL_AGENCY',
          kind: 'SN',
          parcels: [{ product: 'Soja', quantity: 100, unit: 'MT', operation: 'Load' }],
        },
        USER_ID,
      );

      expect(mockPrisma.cargo.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 2. update — terminal status blocks edit
  // -------------------------------------------------------------------------
  describe('update', () => {
    it('allows update when the nomination is not cancelled', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID, status: 'NOMINATED' });
      mockPrisma.nomination.update.mockResolvedValue({ ...mockNomBase, voyageNumber: 'NEW' });

      const result = await service.update(NOM_ID, { voyageNumber: 'NEW' }, USER_ID);

      expect(result.voyageNumber).toBe('NEW');
      expect(result.status).toBe('NOMINATED');
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
    it('throws BadRequestException for a non-CANCELLED target (status is derived)', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ ...mockNomBase, status: 'NOMINATED' });

      await expect(service.transition(NOM_ID, { toStatus: 'IN_PORT' }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for CANCELLED without reason', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ ...mockNomBase, status: 'NOMINATED' });

      await expect(service.transition(NOM_ID, { toStatus: 'CANCELLED' }, USER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when the nomination is already cancelled', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ ...mockNomBase, status: 'CANCELLED' });

      await expect(
        service.transition(NOM_ID, { toStatus: 'CANCELLED', reason: 'dupe' }, USER_ID),
      ).rejects.toThrow(BadRequestException);
    });

    it('cancels a NOMINATED nomination and writes one history row', async () => {
      const cancelledNom = { ...mockNomBase, status: 'CANCELLED' as const };

      mockPrisma.nomination.findUnique.mockResolvedValue({ ...mockNomBase, status: 'NOMINATED' });
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => {
          mockPrisma.nomination.update.mockResolvedValue(cancelledNom);
          mockPrisma.nominationStatusHistory.create.mockResolvedValue({});
          return fn(mockPrisma);
        },
      );

      const result = await service.transition(
        NOM_ID,
        { toStatus: 'CANCELLED', reason: 'duplicate nomination' },
        USER_ID,
      );

      expect((result as { status: string }).status).toBe('CANCELLED');
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.nominationStatusHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: 'NOMINATED', toStatus: 'CANCELLED' }),
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
  const SALE_END = new Date(NOW.getTime() + 3_600_000);
  const SALE_CREATE = {
    serviceNo: '6009',
    clientId: 'clclient00000001',
    serviceId: 'clservice0000001',
    route: 'Guaraguao - Muelle 3',
    portId: 'clport0000000001',
    price: 1500.5,
    startAt: NOW,
    endAt: SALE_END,
    description: null,
    driverId: 'cldriver00000001',
    userId: 'cluser0000000001',
  };
  const mockSale = {
    id: SALE_ID,
    nominationId: NOM_ID,
    ...SALE_CREATE,
    client: { id: SALE_CREATE.clientId, name: 'Acme Shipping S.A.' },
    service: { id: SALE_CREATE.serviceId, name: 'Launch / Boat Service' },
    port: { id: SALE_CREATE.portId, name: 'Puerto La Cruz' },
    driver: { id: SALE_CREATE.driverId, name: 'J. Ramirez' },
    user: { id: SALE_CREATE.userId, name: 'M. Perez' },
    createdAt: NOW,
    updatedAt: NOW,
  };
  /** assertSaleExists selects only the service window. */
  const mockSaleWindow = { startAt: NOW, endAt: SALE_END };

  describe('listSales', () => {
    it('throws NotFoundException for an unknown nomination', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(null);

      await expect(service.listSales(NOM_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns sales with client/service/port/driver/user includes ordered by start time', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue({ id: NOM_ID });
      mockPrisma.sale.findMany.mockResolvedValue([mockSale]);

      const result = await service.listSales(NOM_ID);

      expect(result).toEqual([mockSale]);
      expect(mockPrisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { nominationId: NOM_ID },
          orderBy: { startAt: 'asc' },
          include: expect.objectContaining({
            port: expect.anything(),
            driver: expect.anything(),
            user: expect.anything(),
          }),
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
      mockPrisma.sale.findFirst.mockResolvedValue(mockSaleWindow);
      mockPrisma.sale.update.mockResolvedValue({ ...mockSale, price: 2000 });

      const result = await service.updateSale(NOM_ID, SALE_ID, { price: 2000 });

      expect((result as { price: number }).price).toBe(2000);
      expect(mockPrisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SALE_ID }, data: { price: 2000 } }),
      );
    });

    // SaleUpdateSchema can only compare the two timestamps when the client sends
    // both, so a PATCH moving just one of them is validated against the stored row.
    it('rejects an endAt moved before the stored startAt', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(mockSaleWindow);

      await expect(
        service.updateSale(NOM_ID, SALE_ID, { endAt: new Date(NOW.getTime() - 1000) }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sale.update).not.toHaveBeenCalled();
    });

    it('rejects a startAt moved after the stored endAt', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(mockSaleWindow);

      await expect(
        service.updateSale(NOM_ID, SALE_ID, { startAt: new Date(SALE_END.getTime() + 1000) }),
      ).rejects.toThrow(BadRequestException);
      expect(mockPrisma.sale.update).not.toHaveBeenCalled();
    });

    it('allows clearing endAt — the service is running again', async () => {
      mockPrisma.sale.findFirst.mockResolvedValue(mockSaleWindow);
      mockPrisma.sale.update.mockResolvedValue({ ...mockSale, endAt: null });

      await service.updateSale(NOM_ID, SALE_ID, { endAt: null });

      expect(mockPrisma.sale.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: SALE_ID }, data: { endAt: null } }),
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
      mockPrisma.sale.findFirst.mockResolvedValue(mockSaleWindow);
      mockPrisma.sale.delete.mockResolvedValue(mockSale);

      await service.removeSale(NOM_ID, SALE_ID);

      expect(mockPrisma.sale.delete).toHaveBeenCalledWith({ where: { id: SALE_ID } });
    });
  });

  // -------------------------------------------------------------------------
  // list — date range
  //
  // dateNominated is a timestamptz while the filter is a calendar date. Using `lte: dateTo`
  // resolved to midnight, so anything recorded later on the end date itself was silently
  // dropped — a nomination dated 12 Jun 09:00 vanished from a "to 12 Jun" filter.
  // -------------------------------------------------------------------------
  describe('list — date range', () => {
    beforeEach(() => {
      mockPrisma.nomination.findMany.mockResolvedValue([]);
      mockPrisma.nomination.count.mockResolvedValue(0);
    });

    const whereFromLastCall = (): Record<string, unknown> => {
      const call = mockPrisma.nomination.findMany.mock.calls.at(-1) as [
        { where: Record<string, unknown> },
      ];
      return call[0].where;
    };

    it('makes dateTo inclusive of the whole end day', async () => {
      await service.list({
        page: 1,
        pageSize: 25,
        dateTo: new Date('2026-06-12T00:00:00.000Z'),
      } as never);

      const range = whereFromLastCall().dateNominated as { lt: Date; lte?: Date };
      // Exclusive upper bound at the *next* midnight covers all of 12 June.
      expect(range.lt.toISOString()).toBe('2026-06-13T00:00:00.000Z');
      expect(range.lte).toBeUndefined();
    });

    it('keeps dateFrom as an inclusive lower bound', async () => {
      await service.list({
        page: 1,
        pageSize: 25,
        dateFrom: new Date('2026-06-10T00:00:00.000Z'),
      } as never);

      const range = whereFromLastCall().dateNominated as { gte: Date };
      expect(range.gte.toISOString()).toBe('2026-06-10T00:00:00.000Z');
    });

    it('applies both bounds together', async () => {
      await service.list({
        page: 1,
        pageSize: 25,
        dateFrom: new Date('2026-06-10T00:00:00.000Z'),
        dateTo: new Date('2026-06-12T00:00:00.000Z'),
      } as never);

      const range = whereFromLastCall().dateNominated as { gte: Date; lt: Date };
      expect(range.gte.toISOString()).toBe('2026-06-10T00:00:00.000Z');
      expect(range.lt.toISOString()).toBe('2026-06-13T00:00:00.000Z');
    });

    it('omits the date filter entirely when neither bound is given', async () => {
      await service.list({ page: 1, pageSize: 25 } as never);

      expect(whereFromLastCall().dateNominated).toBeUndefined();
    });
  });
  // -------------------------------------------------------------------------
  // resolveNominatingParty — the acknowledgement email's "TO:" line
  //
  // The nominating company lives only in the client list. The four default rows
  // are auto-created blank on every nomination, so blanks must be skipped rather
  // than emitted as a bare "TO:". nominatedById is an internal user and is a last
  // resort only.
  // -------------------------------------------------------------------------
  describe('resolveNominatingParty', () => {
    const resolve = (
      clients: { type: string; name: string }[],
      nominatedBy: { displayName: string | null; email: string } | null = null,
    ): string =>
      (
        NominationsService as unknown as {
          resolveNominatingParty: (
            c: { type: string; name: string }[],
            n: { displayName: string | null; email: string } | null,
          ) => string;
        }
      ).resolveNominatingParty(clients, nominatedBy);

    it('prefers the charterer over other filled rows', () => {
      expect(
        resolve([
          { type: 'Shipper', name: 'Cargill S.A.' },
          { type: 'Charterer', name: 'Reliance Industries Limited' },
        ]),
      ).toBe('Reliance Industries Limited');
    });

    it('falls through the priority order when the charterer row is blank', () => {
      expect(
        resolve([
          { type: 'Charterer', name: '   ' },
          { type: 'Disponent Owner', name: 'Nordic Bulk Carriers AS' },
        ]),
      ).toBe('Nordic Bulk Carriers AS');
    });

    it('matches the type case-insensitively and trims the name', () => {
      expect(resolve([{ type: '  CHARTERER ', name: '  Bunge Uruguay S.A. ' }])).toBe(
        'Bunge Uruguay S.A.',
      );
    });

    it('uses any other filled row before falling back to a user', () => {
      expect(
        resolve([{ type: 'Receivers', name: 'SGS Uruguay S.A.' }], {
          displayName: 'Martin Silva',
          email: 'ops@portlog.local',
        }),
      ).toBe('SGS Uruguay S.A.');
    });

    it('defaults to nominatedById when no company is recorded', () => {
      expect(
        resolve([{ type: 'Charterer', name: '' }], {
          displayName: 'Martin Silva',
          email: 'ops@portlog.local',
        }),
      ).toBe('Martin Silva');
    });

    it('uses the user email when that user has no display name', () => {
      expect(resolve([], { displayName: null, email: 'ops@portlog.local' })).toBe(
        'ops@portlog.local',
      );
    });

    it('returns empty so the TO: line is omitted entirely', () => {
      expect(resolve([{ type: 'Charterer', name: '' }], null)).toBe('');
      expect(resolve([], null)).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // resolveClientByType — the pre-arrival letter's "Cc:" (operator) and its
  // "on behalf of Charterers …" clause read different slices of the same list.
  // -------------------------------------------------------------------------
  describe('resolveClientByType', () => {
    const svc = NominationsService as unknown as {
      resolveClientByType: (
        c: { type: string; name: string }[],
        priority: readonly string[],
      ) => string;
      OPERATOR_TYPES: readonly string[];
      CHARTERER_TYPES: readonly string[];
    };

    const operator = (clients: { type: string; name: string }[]) =>
      svc.resolveClientByType(clients, svc.OPERATOR_TYPES);
    const charterer = (clients: { type: string; name: string }[]) =>
      svc.resolveClientByType(clients, svc.CHARTERER_TYPES);

    it('picks the commercial operator ahead of the owner rows', () => {
      expect(
        operator([
          { type: 'Head Owner', name: 'Maran Tankers Management INC' },
          { type: 'Commercial Operator', name: 'Maran Tankers Ops Dpt' },
        ]),
      ).toBe('Maran Tankers Ops Dpt');
    });

    it('falls through to an owner row when no operator is named', () => {
      expect(
        operator([
          { type: 'Commercial Operator', name: '  ' },
          { type: 'Disponent Owner', name: 'Nordic Bulk Carriers AS' },
        ]),
      ).toBe('Nordic Bulk Carriers AS');
    });

    it('does not treat the charterer as the operator', () => {
      expect(operator([{ type: 'Charterer', name: 'Reliance Industries Limited' }])).toBe('');
    });

    it('resolves the charterer, time charter included', () => {
      expect(charterer([{ type: 'Charterer', name: 'Reliance Industries Limited' }])).toBe(
        'Reliance Industries Limited',
      );
      expect(charterer([{ type: 'Time Charter', name: 'Cargill S.A.' }])).toBe('Cargill S.A.');
    });

    it('does not treat the operator as the charterer', () => {
      expect(charterer([{ type: 'Commercial Operator', name: 'Maran Tankers Ops Dpt' }])).toBe('');
    });

    it('returns empty when nothing matches, so the line is dropped', () => {
      expect(operator([])).toBe('');
      expect(charterer([{ type: 'Shipper', name: 'Cargill S.A.' }])).toBe('');
    });
  });

  // -------------------------------------------------------------------------
  // getComposeData — recipients
  //
  // Every notice defaults to the nomination's own list, which is the client's.
  // "ETA — Send to Terminal" and the NOR are the exceptions: both go to the
  // shipper and the terminal. They were going to the client until 2 Aug 2026,
  // because compose returned nomination.emailTo for every type. Addressed
  // outside the client's list, they carry the agency's own copies explicitly —
  // branch on Cc, head office on Bcc.
  // -------------------------------------------------------------------------
  describe('getComposeData — recipients', () => {
    const TERMINAL_EMAILS = ['loadingmaster@taecjaa.com', 'ops@taecjaa.com'];
    const SHIPPER_EMAILS = ['docs@cargill.com'];

    /** Branch as the compose select shapes it; email lists set per case. */
    const BRANCH_FIXTURE = {
      name: 'José Branch',
      code: 'JSE',
      emails: [] as string[],
      address: null,
      phone: null,
      fax: null,
      mobile24h: null,
      coverage: null,
      contactName: null,
      contactTitle: null,
      contactMobile: null,
      contactEmails: [] as string[],
      centralEmails: [] as string[],
    };

    /** A nomination shaped like the compose select, overridable per case. */
    function composeNomination(overrides: Record<string, unknown> = {}) {
      return {
        emailTo: ['charterer@ril.com'],
        emailCc: ['ops@navieramar.com'],
        emailBcc: [],
        subject: null,
        referenceNo: null,
        parcels: [],
        dateNominated: NOW,
        voyageNumber: '029',
        correlative: 1522,
        kind: 'SN' as const,
        layDaysFirst: null,
        layDaysLast: null,
        etaDate: null,
        nominationType: 'FULL_AGENCY' as const,
        master: null,
        nominationClients: [
          { type: 'Charterer', name: 'Reliance Industries Limited', shipper: null },
          {
            type: 'Shipper',
            name: 'Cargill S.A.',
            shipper: { name: 'Cargill S.A.', emails: SHIPPER_EMAILS },
          },
        ],
        nominatedBy: null,
        shipParticular: { name: 'HAKKAISAN' },
        opPort: { name: 'PDVSA TAECJAA OFF-SHORE PLATFORM, JOSE', emails: TERMINAL_EMAILS },
        lastPort: null,
        nextPort: null,
        branch: null,
        ...overrides,
      };
    }

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pedr.findUnique.mockResolvedValue({ etaRecord: null });
      mockEmailTemplateService.render.mockResolvedValue({
        subject: null,
        bodyText: 'body',
        bodyHtml: '<pre>body</pre>',
      });
    });

    it('addresses the terminal notice to the terminal and the shipper', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual([...TERMINAL_EMAILS, ...SHIPPER_EMAILS]);
      // The agency's internal copies apply to this notice too.
      expect(data.ccAddresses).toEqual(['ops@navieramar.com']);
    });

    it('does not write the terminal notice to the client', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(data.toAddresses).not.toContain('charterer@ril.com');
    });

    it('drops an address registered on both the terminal and the shipper', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          nominationClients: [
            {
              type: 'Shipper',
              name: 'Cargill S.A.',
              // Same address as the terminal's, spelled differently.
              shipper: { name: 'Cargill S.A.', emails: ['Ops@TAECJAA.com'] },
            },
          ],
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual(TERMINAL_EMAILS);
    });

    it('sends to the terminal alone when the shipper row is hand-typed', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          nominationClients: [{ type: 'Shipper', name: 'Some Trader Ltd', shipper: null }],
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual(TERMINAL_EMAILS);
    });

    it("falls back to the nomination's list when neither is registered", async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          opPort: { name: 'PDVSA TAECJAA OFF-SHORE PLATFORM, JOSE', emails: [] },
          nominationClients: [{ type: 'Shipper', name: '', shipper: null }],
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      // Better an editable wrong list than an empty To that reads as a bug.
      expect(data.toAddresses).toEqual(['charterer@ril.com']);
    });

    it('leaves every other notice on the client list', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      const data = await service.getComposeData(NOM_ID, 'ACKNOWLEDGEMENT', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual(['charterer@ril.com']);
    });

    it('addresses the NOR to the terminal and the shipper too', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      const data = await service.getComposeData(NOM_ID, 'NOR', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual([...TERMINAL_EMAILS, ...SHIPPER_EMAILS]);
      expect(data.toAddresses).not.toContain('charterer@ril.com');
    });

    it('copies the branch and blind-copies head office on the NOR', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          branch: {
            ...BRANCH_FIXTURE,
            emails: ['jse@navieramar.com'],
            centralEmails: ['supervision@navieramar.com'],
          },
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'NOR', 'agent@navieramar.com');

      // Appended to the nomination's own Cc, not swapped for it.
      expect(data.ccAddresses).toEqual(['ops@navieramar.com', 'jse@navieramar.com']);
      // Bcc, so the terminal and the shipper never see the oversight list.
      expect(data.bccAddresses).toEqual(['supervision@navieramar.com']);
    });

    it('leaves the client-addressed notices without the branch copies', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          branch: {
            ...BRANCH_FIXTURE,
            emails: ['jse@navieramar.com'],
            centralEmails: ['supervision@navieramar.com'],
          },
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'PREARRIVAL', 'agent@navieramar.com');

      expect(data.ccAddresses).toEqual(['ops@navieramar.com']);
      expect(data.bccAddresses).toEqual([]);
    });

    it('adds nothing when the branch has no addresses registered', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          branch: { ...BRANCH_FIXTURE, emails: [], centralEmails: [] },
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'NOR', 'agent@navieramar.com');

      expect(data.ccAddresses).toEqual(['ops@navieramar.com']);
      expect(data.bccAddresses).toEqual([]);
    });

    it("hands the template the shipper's name for the body CC line", async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(mockEmailTemplateService.render).toHaveBeenCalledWith(
        '01_prearrival/03_eta_forwarded_to_terminal.hbs',
        expect.objectContaining({ shipper_name: 'Cargill S.A.' }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // resolveShipper — the shipper named on the terminal notice
  //
  // "ETA — Send to Terminal" is addressed to the shipper and the terminal, so
  // this feeds both the body's "CC:" line and the To line. Addresses come only
  // from the linked master-data record: a notice must never be mailed to a
  // company picked by matching a hand-typed name.
  // -------------------------------------------------------------------------
  describe('resolveShipper', () => {
    type Row = {
      type: string;
      name: string;
      shipper?: { name: string; emails: string[] } | null;
    };
    const resolve = (clients: Row[]): { name: string; emails: string[] } =>
      (
        NominationsService as unknown as {
          resolveShipper: (c: Row[]) => { name: string; emails: string[] };
        }
      ).resolveShipper(clients);

    it('returns the linked shipper name and addresses', () => {
      expect(
        resolve([
          { type: 'Charterer', name: 'Reliance Industries Limited' },
          {
            type: 'Shipper',
            name: 'Cargill S.A.',
            shipper: { name: 'Cargill S.A.', emails: ['ops@cargill.com', 'docs@cargill.com'] },
          },
        ]),
      ).toEqual({ name: 'Cargill S.A.', emails: ['ops@cargill.com', 'docs@cargill.com'] });
    });

    it('gives a hand-typed row its name but no addresses', () => {
      expect(resolve([{ type: 'Shipper', name: 'Some Trader Ltd', shipper: null }])).toEqual({
        name: 'Some Trader Ltd',
        emails: [],
      });
    });

    it('matches the type case-insensitively and trims the name', () => {
      expect(resolve([{ type: ' SHIPPER ', name: '  Cargill S.A. ' }])).toEqual({
        name: 'Cargill S.A.',
        emails: [],
      });
    });

    it('falls back to the linked record name when the row name is blank', () => {
      expect(
        resolve([
          {
            type: 'Shipper',
            name: '   ',
            shipper: { name: 'Cargill S.A.', emails: ['ops@cargill.com'] },
          },
        ]),
      ).toEqual({ name: 'Cargill S.A.', emails: ['ops@cargill.com'] });
    });

    it('skips the blank rows auto-created on every nomination', () => {
      expect(
        resolve([
          { type: 'Charterer', name: '' },
          { type: 'Shipper', name: '' },
        ]),
      ).toEqual({ name: '', emails: [] });
    });

    it('returns empty when no shipper row exists, so the CC line is dropped', () => {
      expect(resolve([{ type: 'Charterer', name: 'Reliance Industries Limited' }])).toEqual({
        name: '',
        emails: [],
      });
    });
  });
});

// ---------------------------------------------------------------------------
// dedupeEmails — the To line of a terminal notice merges two address lists, and
// the same terminal address is routinely registered in both.
// ---------------------------------------------------------------------------
describe('dedupeEmails', () => {
  it('keeps distinct addresses in the order given', () => {
    expect(dedupeEmails(['ops@terminal.com', 'docs@cargill.com'])).toEqual([
      'ops@terminal.com',
      'docs@cargill.com',
    ]);
  });

  it('drops case-only duplicates, keeping the first spelling', () => {
    expect(dedupeEmails(['Ops@Terminal.com', 'ops@terminal.com'])).toEqual(['Ops@Terminal.com']);
  });

  it('trims and drops blanks rather than emitting an empty recipient', () => {
    expect(dedupeEmails(['  ops@terminal.com  ', '', '   '])).toEqual(['ops@terminal.com']);
  });

  it('returns empty for an empty list', () => {
    expect(dedupeEmails([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Notice formatters — these render onto legally binding notices, so the exact
// output matters and is pinned here.
// ---------------------------------------------------------------------------
describe('formatLaydayRange', () => {
  // Local dates: the formatter reads calendar parts, matching how the agency
  // reads laydays off the fixture.
  const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

  it('collapses month and year when both ends share them', () => {
    expect(formatLaydayRange(d(2026, 7, 6), d(2026, 7, 10))).toBe('Jul. 06th-10th, 2026');
  });

  it('repeats the month across a month boundary', () => {
    expect(formatLaydayRange(d(2026, 7, 30), d(2026, 8, 2))).toBe('Jul. 30th - Aug. 02nd, 2026');
  });

  it('repeats the year across a year boundary', () => {
    expect(formatLaydayRange(d(2025, 12, 30), d(2026, 1, 2))).toBe(
      'Dec. 30th, 2025 - Jan. 02nd, 2026',
    );
  });

  it('renders a single date when only one end is set', () => {
    expect(formatLaydayRange(d(2026, 2, 3), null)).toBe('Feb. 03rd, 2026');
    expect(formatLaydayRange(null, d(2026, 2, 7))).toBe('Feb. 07th, 2026');
  });

  it('returns empty when no laydays are recorded, so the line is dropped', () => {
    expect(formatLaydayRange(null, null)).toBe('');
  });

  it('uses "th" for the teens rather than st/nd/rd', () => {
    expect(formatLaydayRange(d(2026, 5, 11), d(2026, 5, 13))).toBe('May. 11th-13th, 2026');
    expect(formatLaydayRange(d(2026, 5, 21), d(2026, 5, 22))).toBe('May. 21st-22nd, 2026');
  });
});

describe('formatCargoQuantity', () => {
  it('groups thousands so a cargo figure is readable', () => {
    expect(formatCargoQuantity(1900000)).toBe('1,900,000');
    expect(formatCargoQuantity(2000)).toBe('2,000');
    expect(formatCargoQuantity(999)).toBe('999');
  });

  it('accepts the numeric strings that come out of the parcels JSON', () => {
    expect(formatCargoQuantity('1900000')).toBe('1,900,000');
  });

  it('renders nothing for a missing quantity rather than "0" or "NaN"', () => {
    expect(formatCargoQuantity(null)).toBe('');
    expect(formatCargoQuantity(undefined)).toBe('');
    expect(formatCargoQuantity('')).toBe('');
  });

  it('passes non-numeric text through untouched', () => {
    expect(formatCargoQuantity('part cargo')).toBe('part cargo');
  });
});

describe('formatEtcStamp', () => {
  it('renders the picked ETC as DD/MM/YYYY HH:mm', () => {
    expect(formatEtcStamp('2026-08-02', '02:00')).toBe('02/08/2026 02:00');
  });

  it('keeps 24-hour times as picked — an ETC is never AM/PM on a notice', () => {
    expect(formatEtcStamp('2026-08-02', '23:45')).toBe('02/08/2026 23:45');
  });

  it('keeps midnight on the day it was picked', () => {
    // The stamp is reordered textually, never parsed through `Date` — a UTC
    // parse of "2026-08-02T00:30" would render as the 1st on any negative
    // offset, moving a legally binding ETC by a day.
    expect(formatEtcStamp('2026-08-02', '00:30')).toBe('02/08/2026 00:30');
  });

  it('drops the time when only a date was picked', () => {
    expect(formatEtcStamp('2026-08-02', '')).toBe('02/08/2026');
    expect(formatEtcStamp('2026-08-02', null)).toBe('02/08/2026');
  });

  it('returns empty when no ETC is recorded, so the line reads as blank', () => {
    expect(formatEtcStamp(null, null)).toBe('');
    expect(formatEtcStamp(undefined, undefined)).toBe('');
    expect(formatEtcStamp('', '')).toBe('');
  });

  it('passes legacy free-typed values through untouched', () => {
    expect(formatEtcStamp('Aug 02nd, 2026 02:00', undefined)).toBe('Aug 02nd, 2026 02:00');
  });
});
