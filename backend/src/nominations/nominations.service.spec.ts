import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import {
  NominationsService,
  alignFigureColumn,
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
// Compose fixtures — shared by every getComposeData describe below
// ---------------------------------------------------------------------------

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
  emailDispatch: {
    create: jest.fn(),
    update: jest.fn(),
  },
  sofTimesheet: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockEmailService = {
  send: jest.fn(),
};

const mockAttachmentsService = {
  resolveForSend: jest.fn().mockResolvedValue([]),
  linkToEmailDispatch: jest.fn().mockResolvedValue(undefined),
};

// Template rendering is covered by email-template.service.spec.ts, which renders
// the real files; here the stub returns a fixed body so compose specs can assert
// on recipients and on the variables handed to the template.
const mockEmailTemplateService = {
  render: jest.fn(),
};

/** The variables handed to the template on the most recent render. */
function lastTemplateVars(): Record<string, unknown> {
  const calls = mockEmailTemplateService.render.mock.calls as unknown[][];
  const last = calls[calls.length - 1];
  return (last?.[1] ?? {}) as Record<string, unknown>;
}

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
  // sendEmail — the compose drawer posts plain text; the fixed-width layout of
  // a notice only survives a mail client if it is wrapped on the way out, and
  // the dispatch row has to archive the same copy that was mailed.
  // -------------------------------------------------------------------------
  describe('sendEmail', () => {
    const BODY = 'Ref: MT Maran Leo\nLaydays: Jul. 06th-10th, 2026';

    const input = (bodyText: string) => ({
      subDocType: 'NOR' as const,
      toAddresses: ['terminal@puerto.com'],
      ccAddresses: [],
      bccAddresses: [],
      subject: 'NOTICE OF READINESS — MT MARAN LEO',
      bodyText,
      attachmentIds: [],
    });

    beforeEach(() => {
      mockPrisma.pedr.findUnique.mockResolvedValue({ id: 'pedr-1' });
      mockPrisma.emailDispatch.create.mockResolvedValue({ id: 'disp-1' });
      mockPrisma.emailDispatch.update.mockResolvedValue({ id: 'disp-1' });
    });

    it('wraps the plain-text body before it reaches SMTP', async () => {
      await service.sendEmail('nom-1', input(BODY), 'user-1');

      const { html } = mockEmailService.send.mock.calls[0][0] as { html: string };
      expect(html.startsWith('<pre style=')).toBe(true);
      // Line breaks intact — a flattened notice is the failure this guards.
      expect(html).toContain('Ref: MT Maran Leo\nLaydays: Jul. 06th-10th, 2026');
    });

    it('archives exactly what was mailed', async () => {
      await service.sendEmail('nom-1', input(BODY), 'user-1');

      const { html } = mockEmailService.send.mock.calls[0][0] as { html: string };
      const created = mockPrisma.emailDispatch.create.mock.calls[0][0] as {
        data: { bodyHtml: string };
      };
      expect(created.data.bodyHtml).toBe(html);
    });

    it('leaves an already-wrapped body alone, so a re-send is not double-wrapped', async () => {
      const alreadyWrapped = '<pre style="font-family:monospace">Ref: MT Maran Leo</pre>';

      await service.sendEmail('nom-1', input(alreadyWrapped), 'user-1');

      const { html } = mockEmailService.send.mock.calls[0][0] as { html: string };
      expect(html).toBe(alreadyWrapped);
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
  // getComposeData — the named parties in a notice header
  //
  // The agency reads a notice header as companies, not mailboxes:
  //
  //     To: HAKKAISAN               Attn: Master Anjan Saini
  //     Cc: MOL India Private Limited
  //     Cc: Mitsui O.S.K. Lines, Ltd., Tokyo/CRAMO
  //     Cc: MOL Global Ship Management Pte Ltd
  // -------------------------------------------------------------------------
  describe('getComposeData — header parties', () => {
    /** A roster carrying all four owner/operator types plus the cargo side. */
    const ROSTER = [
      { type: 'Charterer', name: 'Reliance Industries Limited', shipper: null },
      { type: 'Commercial Operator', name: 'MOL India Private Limited', shipper: null },
      { type: 'Head Owner', name: 'Mitsui O.S.K. Lines, Ltd., Tokyo/CRAMO', shipper: null },
      { type: 'Technical Operator', name: 'MOL Global Ship Management Pte Ltd', shipper: null },
      // Auto-created and never filled in — must not print an empty Cc line.
      { type: 'Disponent Owner', name: '  ', shipper: null },
      {
        type: 'Shipper',
        name: 'Cargill S.A.',
        shipper: { name: 'Cargill S.A.', emails: SHIPPER_EMAILS },
      },
    ];

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pedr.findUnique.mockResolvedValue({ etaRecord: null });
      mockEmailTemplateService.render.mockResolvedValue({
        subject: null,
        bodyText: 'body',
        bodyHtml: '<pre>body</pre>',
      });
    });

    it('addresses the To line to the vessel, with the master in a fixed column', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ master: 'Anjan Saini' }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      const toParties = String(lastTemplateVars()['to_parties']);
      expect(toParties.trimEnd()).toContain('HAKKAISAN');
      // Padded, not spaced: the Attn starts in the same column on every notice.
      expect(toParties.indexOf('Attn:')).toBe(24);
      expect(toParties).toContain('Attn: Master Anjan Saini');
      expect(lastTemplateVars()['master_attn']).toBe('Attn: Master Anjan Saini');
    });

    it('leaves the To line as the bare vessel when no master is recorded', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination({ master: null }));

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      // No trailing padding either — there is nothing for it to line up with.
      expect(lastTemplateVars()['to_parties']).toBe('HAKKAISAN');
      expect(lastTemplateVars()['master_attn']).toBe('');
    });

    it('writes one Cc line per owner/operator company, in roster order', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ nominationClients: ROSTER }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(lastTemplateVars()['cc_parties']).toBe(
        [
          'Cc: MOL India Private Limited',
          'Cc: Mitsui O.S.K. Lines, Ltd., Tokyo/CRAMO',
          'Cc: MOL Global Ship Management Pte Ltd',
        ].join('\n'),
      );
    });

    it('keeps the cargo side off the Cc lines', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ nominationClients: ROSTER }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      const ccParties = String(lastTemplateVars()['cc_parties']);
      expect(ccParties).not.toContain('Reliance');
      expect(ccParties).not.toContain('Cargill');
    });

    it('lists a company named under two owner/operator types once', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          nominationClients: [
            { type: 'Head Owner', name: 'Mitsui O.S.K. Lines, Ltd.', shipper: null },
            // Same company, spelled with different case under a second type.
            { type: 'Technical Operator', name: 'MITSUI O.S.K. LINES, LTD.', shipper: null },
          ],
        }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(lastTemplateVars()['cc_parties']).toBe('Cc: Mitsui O.S.K. Lines, Ltd.');
    });

    it('renders no Cc lines at all when the roster names no owner or operator', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(lastTemplateVars()['cc_parties']).toBe('');
    });

    it('titles the notice with the countdown to the ETA', async () => {
      // 80 hours out — past the 96-hour mark, so the notice is the 72-hour one.
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ etaDate: new Date(Date.now() + 80 * 3_600_000) }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(lastTemplateVars()['eta_notice_label']).toBe('72 Hours ETA Notice');
    });

    it("counts from the nomination's ETA, not the ETA the master notified", async () => {
      mockPrisma.pedr.findUnique.mockResolvedValue({
        etaRecord: {
          msgEta: null,
          // Six days out. The body prints this as `eta_date`, but the countdown
          // deliberately does not follow it — the notice series is numbered off
          // the arrival the call was booked against, so a vessel never jumps
          // back from "72 Hours" to "6 DAYS" because the master revised.
          etaNotify: new Date(Date.now() + 6 * 24 * 3_600_000 + 3_600_000),
          etaNotifyOn: true,
          etpob: null,
          etpobOn: false,
          etb: null,
          etbOn: false,
          refMessage: null,
        },
      });
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ etaDate: new Date(Date.now() + 80 * 3_600_000) }),
      );

      await service.getComposeData(NOM_ID, 'ETA_REPLY', 'agent@navieramar.com');

      // 80h out rounds down to the 72-hour bucket.
      expect(lastTemplateVars()['eta_notice_label']).toBe('72 Hours ETA Notice');
    });

    it('states an unqualified notice when no ETA is recorded at all', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination({ etaDate: null }));

      await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      // Not '' — the subject is built as "<ref> - <label>", so an empty label
      // left a dangling " - " on the face of the mail.
      expect(lastTemplateVars()['eta_notice_label']).toBe('ETA Notice');
    });

    it('fills the terminal notice Operation line with the parcel figures', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          parcels: [
            {
              operation: 'Load',
              quantity: 755553,
              unit: 'BBLS',
              product: 'Merey 16 Crude Oil',
            },
            { operation: 'Load', quantity: 250000, unit: 'BBLS', product: 'Merey 20 Crude Oil' },
          ],
        }),
      );

      await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(lastTemplateVars()['operation']).toBe(
        'Load 755,553.00 BBLS Merey 16 Crude Oil; Load 250,000.00 BBLS Merey 20 Crude Oil',
      );
    });

    it('leaves the Operation line bare on notices that do not carry figures', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          parcels: [
            { operation: 'Load', quantity: 755553, unit: 'BBLS', product: 'Merey 16 Crude Oil' },
          ],
        }),
      );

      await service.getComposeData(NOM_ID, 'PREARRIVAL', 'agent@navieramar.com');

      expect(lastTemplateVars()['operation']).toBe('Load');
    });
  });

  // -------------------------------------------------------------------------
  // getComposeData — the two notices exchanged with the bridge
  //
  // ETA_REQUEST and ETA_REPLY are the master's own correspondence: they are
  // mailed to the ship and copied to the companies operating her, never to the
  // charterer whose addresses the nomination's list holds.
  // -------------------------------------------------------------------------
  describe('getComposeData — the master-addressed notices', () => {
    const VESSEL = {
      name: 'HAKKAISAN',
      emails: ['master@hakkaisan.sat'],
      owner: {
        name: 'Mitsui O.S.K. Lines, Ltd.',
        // An Owner has no address column — its contacts are the only way in.
        contacts: [{ emails: ['chartering@mol.co.jp'] }],
      },
      operator: {
        name: 'MOL Global Ship Management Pte Ltd',
        emails: ['ops@molgsm.sg'],
        contacts: [{ emails: ['duty@molgsm.sg'] }],
      },
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pedr.findUnique.mockResolvedValue({ etaRecord: null });
      mockEmailTemplateService.render.mockResolvedValue({
        subject: null,
        bodyText: 'body',
        bodyHtml: '<pre>body</pre>',
      });
    });

    it("writes the ETA request to the vessel's own address", async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: VESSEL }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual(['master@hakkaisan.sat']);
      expect(data.toAddresses).not.toContain('charterer@ril.com');
    });

    it('copies the owner and the operator instead of the charterer', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: VESSEL }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(data.ccAddresses).toEqual(['ops@molgsm.sg', 'duty@molgsm.sg', 'chartering@mol.co.jp']);
      expect(data.ccAddresses).not.toContain('ops@navieramar.com');
    });

    it('addresses the reply to the master the same way', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: VESSEL }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REPLY', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual(['master@hakkaisan.sat']);
      expect(data.ccAddresses).toContain('ops@molgsm.sg');
    });

    it("falls back to the nomination's list when the vessel has no address", async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: { ...VESSEL, emails: [] } }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      // Better an editable wrong list than an empty To that reads as a bug.
      expect(data.toAddresses).toEqual(['charterer@ril.com']);
    });

    it('keeps the client Cc when no owner or operator address is registered', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: { ...VESSEL, owner: null, operator: null } }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REQUEST', 'agent@navieramar.com');

      expect(data.ccAddresses).toEqual(['ops@navieramar.com']);
    });

    it('copies the branch and blind-copies head office, as on the terminal notices', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({
          shipParticular: VESSEL,
          branch: {
            ...BRANCH_FIXTURE,
            emails: ['jse@navieramar.com'],
            centralEmails: ['supervision@navieramar.com'],
          },
        }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_REPLY', 'agent@navieramar.com');

      expect(data.ccAddresses).toContain('jse@navieramar.com');
      expect(data.bccAddresses).toEqual(['supervision@navieramar.com']);
    });

    it('leaves the notice to the terminal on the terminal addressing', async () => {
      mockPrisma.nomination.findUnique.mockResolvedValue(
        composeNomination({ shipParticular: VESSEL }),
      );

      const data = await service.getComposeData(NOM_ID, 'ETA_TERMINAL', 'agent@navieramar.com');

      expect(data.toAddresses).toEqual([...TERMINAL_EMAILS, ...SHIPPER_EMAILS]);
      expect(data.toAddresses).not.toContain('master@hakkaisan.sat');
    });
  });

  // -------------------------------------------------------------------------
  // getComposeData — SOF figure blocks
  //
  // Bills of lading and the ship's own figures are compared side by side on the
  // statement, so the columns have to line up on the comma: barrels are stated
  // whole and tonnages to three decimals.
  // -------------------------------------------------------------------------
  describe('getComposeData — SOF figure blocks', () => {
    /** A timesheet with one cargo column of figures on both blocks. */
    const SOF_FIXTURE = {
      entries: [],
      bunkersData: null,
      draftData: null,
      shipFiguresData: {
        columns: ['Merey 16 Crude Oil'],
        rows: {
          bbls: ['1949562'],
          mtons: ['287912.375'],
          ltons: ['283445.5'],
          api: ['16.4'],
          temp: ['120.5'],
          rob: [''],
        },
      },
      blFiguresData: {
        columns: ['Merey 16 Crude Oil'],
        rows: {
          // Truncated, never rounded — .9 of a barrel was not loaded.
          grossBbls: ['755553.9'],
          netBbls: ['750000'],
          grossMt: ['114375.613'],
          netMt: ['113460'],
          grossLt: ['112569.841'],
          netLt: ['111667.5'],
          api: ['16.4'],
          temp: ['120.5'],
          shipper: ['Cargill S.A.'],
          consignee: ['Reliance'],
          destination: ['Sikka'],
          scacCode: ['NVMR'],
          date: ['18/07/2026'],
          blNumber: ['1'],
          remark: [''],
        },
      },
      slopDischargedData: null,
      bunkersReceivedData: null,
      lettersData: null,
      remarksData: null,
    };

    /** The rendered SOF section named by `key`, as lines. */
    async function sofSectionLines(key: string): Promise<string[]> {
      await service.getComposeData(NOM_ID, 'SOF', 'agent@navieramar.com');
      return String(lastTemplateVars()[key]).split('\n');
    }

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pedr.findUnique.mockResolvedValue({ etaRecord: null });
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());
      mockPrisma.sofTimesheet.findUnique.mockResolvedValue(SOF_FIXTURE);
      mockEmailTemplateService.render.mockResolvedValue({
        subject: null,
        bodyText: 'body',
        bodyHtml: '<pre>body</pre>',
      });
    });

    it('states barrels whole and tonnages to three decimals', async () => {
      const lines = await sofSectionLines('bl_figures_section');

      expect(lines).toContainEqual(expect.stringContaining('755,553'));
      expect(lines).not.toContainEqual(expect.stringContaining('755,553.9'));
      expect(lines).toContainEqual(expect.stringContaining('113,460.000'));
      expect(lines).toContainEqual(expect.stringContaining('111,667.500'));
    });

    it('lines the commas of the BL figures up with each other', async () => {
      const lines = await sofSectionLines('bl_figures_section');
      const row = (prefix: string) => lines.find((l) => l.startsWith(prefix)) ?? '';

      const bbls = row('Bbls at 60 F');
      const mtons = row('M/Tons at 60 F');
      const ltons = row('L/Tons at 60 F');

      // Gross column: the comma of "755,553" sits above that of "114,375.613".
      expect(bbls.indexOf(',')).toBe(mtons.indexOf(','));
      expect(bbls.indexOf(',')).toBe(ltons.indexOf(','));
      // Net column, whose start the gross decimals must not have shifted.
      expect(bbls.lastIndexOf(',')).toBe(mtons.lastIndexOf(','));
      expect(bbls.lastIndexOf(',')).toBe(ltons.lastIndexOf(','));
    });

    it('heads each BL column over the figures it belongs to', async () => {
      const lines = await sofSectionLines('bl_figures_section');
      const header = lines.find((l) => l.includes('Gross')) ?? '';
      const mtons = lines.find((l) => l.startsWith('M/Tons at 60 F')) ?? '';

      // Each heading ends where its own column ends.
      const endOf = (line: string, text: string) => line.indexOf(text) + text.length;
      expect(endOf(header, 'Gross')).toBe(endOf(mtons, '114,375.613'));
      expect(endOf(header, 'Net')).toBe(endOf(mtons, '113,460.000'));
    });

    it("states the ship's API and temperature next to its loaded figures", async () => {
      const lines = await sofSectionLines('vessel_cargo_figures_section');

      expect(lines).toContainEqual(expect.stringContaining('API:'));
      expect(lines).toContainEqual(expect.stringContaining('16.4'));
      expect(lines).toContainEqual(expect.stringContaining('Temp:'));
      expect(lines).toContainEqual(expect.stringContaining('120.5'));
    });

    it("quotes the ship's figures in the units the bill states them in", async () => {
      const lines = await sofSectionLines('vessel_cargo_figures_section');
      const row = (label: string) => lines.find((l) => l.startsWith(label)) ?? '';

      // Barrels whole, tonnages to three decimals, and the commas aligned.
      const bbls = row("Ship's Loaded Figures Bbls:");
      const mtons = row("Ship's Loaded Figures M/T:");
      expect(bbls).toContain('1,949,562');
      expect(mtons).toContain('287,912.375');
      expect(row("Ship's Loaded Figures L/T:")).toContain('283,445.500');
      expect(bbls.lastIndexOf(',')).toBe(mtons.lastIndexOf(','));
    });

    it('drops a cargo column that carries no figures at all', async () => {
      mockPrisma.sofTimesheet.findUnique.mockResolvedValue({
        ...SOF_FIXTURE,
        shipFiguresData: {
          columns: ['Merey 16 Crude Oil'],
          rows: { bbls: [''], mtons: [''], ltons: [''], api: [''], temp: [''], rob: [''] },
        },
      });

      await service.getComposeData(NOM_ID, 'SOF', 'agent@navieramar.com');

      expect(lastTemplateVars()['vessel_cargo_figures_section']).toBe('');
    });

    it('suppresses each optional support block when excluded from the final SOF', async () => {
      mockPrisma.sofTimesheet.findUnique.mockResolvedValue({
        ...SOF_FIXTURE,
        includeBunkersDraftParcel: false,
        includeBillShipFigures: false,
        includeLettersRemarks: false,
        includeSlopBunkers: false,
        bunkersData: { IFO: { arrival: '100', sailing: '80' } },
        draftData: { FWD: { arrival: '8', sailing: '7' } },
        lettersData: { items: [{ from: 'Master', to: 'Shore', comment: 'Protest' }] },
        remarksData: {
          items: [
            {
              remark: 'Rain',
              beginDate: '01/08/2026',
              beginTime: '10:00',
              endDate: '01/08/2026',
              endTime: '11:00',
              comment: '',
            },
          ],
        },
        slopDischargedData: {
          rows: [{ event: 'Slop', date: '01/08/2026', time: '12:00' }],
        },
      });

      await service.getComposeData(NOM_ID, 'SOF', 'agent@navieramar.com');

      expect(lastTemplateVars()).toEqual(
        expect.objectContaining({
          arrival_conditions_section: '',
          sailed_conditions_section: '',
          bl_figures_section: '',
          vessel_cargo_figures_section: '',
          letters_section: '',
          remarks_section: '',
          slop_bunkers_section: '',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // The event log a cargo update carries
  //
  // The agency's note on the returned draft was that "Log-." must hold the whole
  // statement of facts from End Of Sea Passage onward. This proves the log is
  // built from every entry the timesheet holds, in the order it holds them.
  // -------------------------------------------------------------------------
  describe('getComposeData — the cargo update event log', () => {
    const entryAt = (isoLocal: string, name: string) => ({
      occurredAt: new Date(isoLocal),
      comment: null,
      activity: { name },
    });

    /** A full call, as a timesheet records it. */
    const ENTRIES = [
      entryAt('2026-07-16T18:24:00', 'End Of Sea Passage'),
      entryAt('2026-07-16T19:00:00', 'Anchored'),
      entryAt('2026-07-17T06:30:00', 'Pilot On Board'),
      entryAt('2026-07-17T08:00:00', 'All Fast'),
      entryAt('2026-07-17T10:12:00', 'Commenced Loading'),
      entryAt('2026-07-18T06:00:00', 'Cargo Update'),
    ];

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.pedr.findUnique.mockResolvedValue({ etaRecord: null });
      mockPrisma.nomination.findUnique.mockResolvedValue(composeNomination());
      mockPrisma.sofTimesheet.findUnique.mockResolvedValue({ entries: ENTRIES });
      mockEmailTemplateService.render.mockResolvedValue({
        subject: null,
        bodyText: 'body',
        bodyHtml: '<pre>body</pre>',
      });
    });

    it('carries every timesheet entry onto the update, in order', async () => {
      await service.getComposeData(NOM_ID, 'CARGO_UPDATE', 'agent@navieramar.com');

      const lines = String(lastTemplateVars()['statement_of_facts_log']).split('\n');
      expect(lines).toHaveLength(ENTRIES.length);
      expect(lines[0]).toBe('Jul-16th, 2026 18:24 End Of Sea Passage');
      expect(lines.at(-1)).toBe('Jul-18th, 2026 06:00 Cargo Update');
      for (const entry of ENTRIES) {
        expect(lines).toContainEqual(expect.stringContaining(entry.activity.name));
      }
    });

    it('reads the timesheet in recorded order and takes no slice of it', async () => {
      await service.getComposeData(NOM_ID, 'CARGO_UPDATE', 'agent@navieramar.com');

      const [args] = mockPrisma.sofTimesheet.findUnique.mock.calls.at(-1) as [
        Record<string, unknown>,
      ];
      const entries = (args['select'] as Record<string, Record<string, unknown>>)['entries'];
      expect(entries?.['orderBy']).toEqual({ order: 'asc' });
      // No take/skip: the whole statement of facts goes on the notice.
      expect(entries?.['take']).toBeUndefined();
      expect(entries?.['skip']).toBeUndefined();
      expect(entries?.['where']).toBeUndefined();
    });

    it('keeps every comment on the same line as its activity', async () => {
      mockPrisma.sofTimesheet.findUnique.mockResolvedValue({
        entries: [
          {
            occurredAt: new Date('2026-07-17T10:12:00'),
            comment: 'Hose connected\nwithout delay',
            activity: { name: 'Commenced Loading' },
          },
          {
            occurredAt: new Date('2026-07-17T11:00:00'),
            comment: 'Rate 29,051 Bbls/Hr',
            activity: { name: '.' },
          },
        ],
      });

      await service.getComposeData(NOM_ID, 'CARGO_UPDATE', 'agent@navieramar.com');

      const log = String(lastTemplateVars()['statement_of_facts_log']);
      expect(log).toContain('Jul-17th, 2026 10:12 Commenced Loading Hose connected without delay');
      expect(log).toContain('Jul-17th, 2026 11:00 . Rate 29,051 Bbls/Hr');
      expect(log).not.toContain('\n     ');
    });
  });

  // -------------------------------------------------------------------------
  // resolveClientNamesByTypes — every owner/operator on the roster
  // -------------------------------------------------------------------------
  describe('resolveClientNamesByTypes', () => {
    type Row = { type: string; name: string };
    const OPERATOR_TYPES = [
      'commercial operator',
      'technical operator',
      'disponent owner',
      'head owner',
    ];
    const resolve = (clients: Row[]): string[] =>
      (
        NominationsService as unknown as {
          resolveClientNamesByTypes: (c: Row[], t: readonly string[]) => string[];
        }
      ).resolveClientNamesByTypes(clients, OPERATOR_TYPES);

    it('returns every matching row in the order the roster lists them', () => {
      expect(
        resolve([
          { type: 'Head Owner', name: 'Mitsui O.S.K. Lines, Ltd.' },
          { type: 'Commercial Operator', name: 'MOL India Private Limited' },
        ]),
      ).toEqual(['Mitsui O.S.K. Lines, Ltd.', 'MOL India Private Limited']);
    });

    it('matches the type case-insensitively and trims the name', () => {
      expect(resolve([{ type: '  TECHNICAL OPERATOR ', name: '  MOL GSM  ' }])).toEqual([
        'MOL GSM',
      ]);
    });

    it('skips the blank rows auto-created on every nomination', () => {
      expect(
        resolve([
          { type: 'Head Owner', name: '' },
          { type: 'Disponent Owner', name: '   ' },
          { type: 'Commercial Operator', name: 'MOL India Private Limited' },
        ]),
      ).toEqual(['MOL India Private Limited']);
    });

    it('leaves the cargo and chartering side out', () => {
      expect(
        resolve([
          { type: 'Charterer', name: 'Reliance Industries Limited' },
          { type: 'Time Charter', name: 'Reliance Industries Limited' },
          { type: 'Shipper', name: 'Cargill S.A.' },
          { type: 'Receivers', name: 'Reliance Jamnagar' },
        ]),
      ).toEqual([]);
    });

    it('names a company appearing under two types once', () => {
      expect(
        resolve([
          { type: 'Head Owner', name: 'Mitsui O.S.K. Lines, Ltd.' },
          { type: 'Technical Operator', name: 'MITSUI O.S.K. LINES, LTD.' },
        ]),
      ).toEqual(['Mitsui O.S.K. Lines, Ltd.']);
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
// alignFigureColumn — the agency's "the commas line up with the commas"
// ---------------------------------------------------------------------------
describe('alignFigureColumn', () => {
  /** Index of the first thousands comma in each padded cell. */
  const commas = (cells: string[]) => cells.map((c) => c.indexOf(','));

  it('puts the comma of a whole figure above that of a three-decimal one', () => {
    const out = alignFigureColumn(['755,553', '114,375.613', '112,569.841']);
    expect(commas(out)).toEqual([3, 3, 3]);
  });

  it('pads the decimals out so the column still ends flush', () => {
    const out = alignFigureColumn(['755,553', '114,375.613']);
    expect(out).toEqual(['755,553    ', '114,375.613']);
    expect(new Set(out.map((c) => c.length)).size).toBe(1);
  });

  it('shifts the shorter integers right, so both integer parts end together', () => {
    const out = alignFigureColumn(['1,949,562', '287,912.375']);
    expect(out).toEqual(['1,949,562    ', '  287,912.375']);
    // The last comma of each figure sits three digits from the end of its
    // integer part, so aligning those ends aligns the commas above them.
    expect(out.map((c) => c.trimEnd().replace(/\..*$/, '').length)).toEqual([9, 9]);
  });

  it('pads a blank cell out rather than collapsing the column', () => {
    expect(alignFigureColumn(['16.4', ''])).toEqual(['16.4', ' '.repeat(4)]);
  });

  it('returns an empty column for an empty list', () => {
    expect(alignFigureColumn([])).toEqual([]);
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
