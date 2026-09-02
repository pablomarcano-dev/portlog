import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service.js';

const REQ_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const SCHEDULED = new Date('2026-08-10T14:00:00.000Z');
const CREATED = new Date('2026-03-01T09:00:00.000Z');

const TUG_DETAILS = { type: 'TUG', operationType: 'BERTHING', tugCount: 2 };
const STS_DETAILS = {
  type: 'STS',
  targetVesselName: 'MT Contraparte',
  ourRole: 'DISCHARGING',
  product: 'Crudo',
  quantity: 500_000,
  quantityUnit: 'BBL',
  equipment: { fenders: true, hoses: true, reducers: false },
  spillPrevention: { floatingBarriers: true, watchBoat: false },
  personnel: { mooringMaster: true, connectionTechnicians: false },
};

const makeRequest = (overrides: Record<string, unknown> = {}) => ({
  id: REQ_ID,
  correlative: 1234,
  type: 'TUG',
  status: 'DRAFT',
  shipParticularId: 'ship-1',
  shipParticular: { id: 'ship-1', name: 'MT Portlog', imoNumber: '9123456' },
  branchId: 'branch-1',
  branch: { id: 'branch-1', name: 'Puerto La Cruz', code: 'PLC' },
  nominationId: null,
  supplierId: 'supplier-1',
  supplier: { id: 'supplier-1', name: 'ATM', emails: ['atm@example.com'] },
  providerEmails: [],
  location: 'BERTH',
  portId: null,
  port: null,
  pierId: null,
  pier: null,
  scheduledAt: SCHEDULED,
  completedAt: null,
  physicalVoucherNo: null,
  notes: null,
  details: TUG_DETAILS,
  billToClientId: null,
  billToClient: null,
  estimatedCost: null,
  actualCost: null,
  currency: 'VES',
  minioKey: null,
  pdfGeneratedAt: null,
  sentAt: null,
  cancelledAt: null,
  cancelReason: null,
  documents: [],
  createdBy: { id: 'user-1', email: 'ops@portlog.local' },
  createdAt: CREATED,
  updatedAt: CREATED,
  ...overrides,
});

describe('ServiceRequestsService', () => {
  let service: ServiceRequestsService;
  let prisma: {
    serviceRequest: Record<string, jest.Mock>;
    serviceRequestDispatch: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    nomination: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let pdf: { renderTemplate: jest.Mock };
  let storage: Record<string, jest.Mock>;
  let email: { send: jest.Mock };
  let attachments: Record<string, jest.Mock>;

  beforeEach(() => {
    prisma = {
      serviceRequest: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      serviceRequestDispatch: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      nomination: { findFirst: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    // The send path runs inside an interactive transaction; hand the callback
    // the same mock client so assertions see the writes.
    prisma.$transaction.mockImplementation((cb: (tx: unknown) => unknown) => cb(prisma));

    pdf = { renderTemplate: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    storage = {
      uploadFile: jest.fn().mockResolvedValue(undefined),
      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    email = { send: jest.fn().mockResolvedValue(undefined) };
    attachments = {
      resolveForSend: jest.fn().mockResolvedValue([]),
      resolveServiceRequestDocuments: jest.fn().mockResolvedValue([]),
      linkToServiceRequestDispatch: jest.fn().mockResolvedValue(undefined),
      attachToServiceRequest: jest.fn().mockResolvedValue(undefined),
      removeFromServiceRequest: jest.fn().mockResolvedValue(undefined),
    };

    service = new ServiceRequestsService(
      prisma as never,
      pdf as never,
      storage as never,
      email as never,
      attachments as never,
    );
  });

  // -------------------------------------------------------------------------
  // Read mapping
  // -------------------------------------------------------------------------

  describe('findOne', () => {
    it('renders the control number from correlative, year and branch code', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());

      const result = await service.findOne(REQ_ID);

      expect(result.controlNumber).toBe('SN1234/26/PLC');
    });

    it('reports whether the authorisation letter is mandatory for this type', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ type: 'STS', details: STS_DETAILS }),
      );

      const result = await service.findOne(REQ_ID);

      expect(result.authorizationRequired).toBe(true);
    });

    it('throws NotFound for an unknown id', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(null);

      await expect(service.findOne(REQ_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // -------------------------------------------------------------------------
  // create / update guards
  // -------------------------------------------------------------------------

  describe('create', () => {
    it('rejects a details payload built for a different request type', async () => {
      await expect(
        service.create(
          {
            type: 'LAUNCH',
            shipParticularId: 'ship-1',
            branchId: 'branch-1',
            scheduledAt: SCHEDULED,
            currency: 'VES',
            details: TUG_DETAILS,
          } as never,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
    });

    it('derives vessel and branch from the selected nomination and records the requester', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findFirst.mockResolvedValue({
        id: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
        shipParticularId: 'ship-1',
        branchId: 'branch-1',
      });
      prisma.serviceRequest.create.mockResolvedValue(makeRequest());

      await service.create(
        {
          type: 'TUG',
          nominationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
          shipParticularId: 'spoofed-ship',
          branchId: 'spoofed-branch',
          scheduledAt: SCHEDULED,
          currency: 'VES',
          details: TUG_DETAILS,
        } as never,
        'user-1',
      );

      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nominationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
            shipParticularId: 'ship-1',
            branchId: 'branch-1',
            createdById: 'user-1',
          }),
        }),
      );
    });

    it('rejects a nomination outside the requester branch', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            type: 'TUG',
            nominationId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
            shipParticularId: 'ship-1',
            branchId: 'branch-2',
            scheduledAt: SCHEDULED,
            currency: 'VES',
            details: TUG_DETAILS,
          } as never,
          'user-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('assigns an administrative service to the user branch without a vessel', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.serviceRequest.create.mockResolvedValue(makeRequest());

      await service.create(
        {
          type: 'GENERAL',
          nominationId: null,
          shipParticularId: null,
          branchId: 'branch-1',
          scheduledAt: SCHEDULED,
          currency: 'VES',
          details: { type: 'GENERAL', route: 'Documents to bank' },
        } as never,
        'user-1',
      );

      expect(prisma.nomination.findFirst).not.toHaveBeenCalled();
      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            nominationId: null,
            shipParticularId: null,
            branchId: 'branch-1',
            createdById: 'user-1',
          }),
        }),
      );
    });
  });

  describe('nominationOptions', () => {
    it('limits selectable SN/OT records to the signed-in user branch', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findMany.mockResolvedValue([]);

      await service.nominationOptions('user-1', 'Nordic');

      expect(prisma.nomination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ branchId: 'branch-1', status: { not: 'CANCELLED' } }),
        }),
      );
    });
  });

  describe('update', () => {
    it('allows any field while the request is a DRAFT', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());
      prisma.serviceRequest.update.mockResolvedValue(makeRequest({ notes: 'FiFi 1 required' }));

      await service.update(REQ_ID, { notes: 'FiFi 1 required', supplierId: 'supplier-2' });

      expect(prisma.serviceRequest.update).toHaveBeenCalled();
    });

    it('freezes the operational fields once the order has been sent', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));

      await expect(service.update(REQ_ID, { supplierId: 'supplier-2' })).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
    });

    it('still accepts the reconciliation fields after send', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      prisma.serviceRequest.update.mockResolvedValue(
        makeRequest({ status: 'SENT', physicalVoucherNo: '6009' }),
      );

      const result = await service.update(REQ_ID, { physicalVoucherNo: '6009' });

      expect(result.physicalVoucherNo).toBe('6009');
    });

    it('rejects a completion time that precedes the scheduled time', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());

      await expect(
        service.update(REQ_ID, { completedAt: new Date('2026-08-09T00:00:00.000Z') }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('refuses to delete anything past DRAFT', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));

      await expect(service.remove(REQ_ID)).rejects.toThrow(ConflictException);
      expect(prisma.serviceRequest.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // transitions
  // -------------------------------------------------------------------------

  describe('transition', () => {
    it('cannot complete a request that was never sent', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'DRAFT' }));

      await expect(service.transition(REQ_ID, { status: 'COMPLETED' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('records the reason when cancelling', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      prisma.serviceRequest.update.mockResolvedValue(makeRequest({ status: 'CANCELLED' }));

      await service.transition(REQ_ID, { status: 'CANCELLED', reason: 'Vessel sailed early' });

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelReason: 'Vessel sailed early',
          }),
        }),
      );
    });

    it('refuses to re-cancel', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'CANCELLED' }));

      await expect(service.transition(REQ_ID, { status: 'CANCELLED' })).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Generar Orden y Enviar
  // -------------------------------------------------------------------------

  describe('sendOrder', () => {
    const sendDto = {
      toAddresses: ['atm@example.com'],
      ccAddresses: [],
      bccAddresses: [],
    };

    beforeEach(() => {
      prisma.serviceRequestDispatch.create.mockResolvedValue({ id: 'dispatch-1' });
      prisma.serviceRequest.update.mockResolvedValue(makeRequest({ status: 'SENT' }));
    });

    it('blocks the send when no provider has been selected', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ supplierId: null, supplier: null }),
      );

      await expect(service.sendOrder(REQ_ID, sendDto as never, 'user-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(email.send).not.toHaveBeenCalled();
    });

    it('blocks the send when a mandatory authorisation letter is missing', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ type: 'STS', details: STS_DETAILS, documents: [] }),
      );

      await expect(service.sendOrder(REQ_ID, sendDto as never, 'user-1')).rejects.toThrow(
        /autorisation|authorisation/i,
      );
      expect(email.send).not.toHaveBeenCalled();
    });

    it('sends once the authorisation letter is on file', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({
          type: 'STS',
          details: STS_DETAILS,
          documents: [
            {
              id: 'att-1',
              filename: 'capitania.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 10,
              createdAt: CREATED,
            },
          ],
        }),
      );

      const result = await service.sendOrder(REQ_ID, sendDto as never, 'user-1');

      expect(email.send).toHaveBeenCalledTimes(1);
      expect(result.dispatch.sentAt).not.toBeNull();
    });

    it('regenerates the PDF so the provider receives the current version', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());

      await service.sendOrder(REQ_ID, sendDto as never, 'user-1');

      expect(pdf.renderTemplate).toHaveBeenCalledWith('orden-de-compra.hbs', expect.any(Object));
      expect(storage.uploadFile).toHaveBeenCalled();
    });

    it('attaches the order PDF and the request documents to the email', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());
      attachments.resolveServiceRequestDocuments.mockResolvedValue([
        { filename: 'capitania.pdf', content: Buffer.from('x'), contentType: 'application/pdf' },
      ]);

      await service.sendOrder(REQ_ID, sendDto as never, 'user-1');

      const sent = email.send.mock.calls[0]![0] as {
        attachments: Array<{ filename: string }>;
        subject: string;
      };
      expect(sent.attachments.map((a) => a.filename)).toEqual([
        'OC-SN1234-26-PLC.pdf',
        'capitania.pdf',
      ]);
      expect(sent.subject).toContain('SN1234/26/PLC');
      expect(sent.subject).toContain('Purchase Order');
    });

    it('snapshots the addresses the order actually went to', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());

      await service.sendOrder(
        REQ_ID,
        { ...sendDto, toAddresses: ['ops@atm.example'] } as never,
        'user-1',
      );

      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'SENT',
            providerEmails: ['ops@atm.example'],
          }),
        }),
      );
    });

    it('keeps the request SENT and records the error when SMTP fails', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());
      email.send.mockRejectedValue(new Error('relay refused'));

      const result = await service.sendOrder(REQ_ID, sendDto as never, 'user-1');

      expect(prisma.serviceRequestDispatch.update).toHaveBeenCalledWith({
        where: { id: 'dispatch-1' },
        data: { error: 'relay refused' },
      });
      expect(result.dispatch.sentAt).toBeNull();
      // Deliberately NOT reverted to DRAFT — see the sendOrder doc comment.
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });

    it('refuses to send a cancelled request', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'CANCELLED' }));

      await expect(service.sendOrder(REQ_ID, sendDto as never, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // list
  // -------------------------------------------------------------------------

  describe('list', () => {
    beforeEach(() => {
      prisma.serviceRequest.findMany.mockResolvedValue([]);
      prisma.serviceRequest.count.mockResolvedValue(0);
    });

    const whereFromLastCall = () =>
      (prisma.serviceRequest.findMany.mock.calls.at(-1) as [{ where: Record<string, unknown> }])[0]
        .where;

    it('matches the numeric part of a quoted control number', async () => {
      await service.list({ search: 'SN1234/26/PLC', page: 1, pageSize: 25 });

      const where = whereFromLastCall();
      const or = (where['AND'] as Array<{ OR: unknown[] }>)[0]!.OR;
      expect(or).toContainEqual({ correlative: 1234 });
    });

    it('matches a zero-padded control number', async () => {
      await service.list({ search: 'SN0007/26/JSE', page: 1, pageSize: 25 });

      const where = whereFromLastCall();
      const or = (where['AND'] as Array<{ OR: unknown[] }>)[0]!.OR;
      expect(or).toContainEqual({ correlative: 7 });
    });

    it('filters on the scheduled window, not on creation date', async () => {
      const from = new Date('2026-08-01T00:00:00.000Z');
      const to = new Date('2026-08-31T23:59:59.000Z');

      await service.list({ dateFrom: from, dateTo: to, page: 1, pageSize: 25 });

      expect(whereFromLastCall()['scheduledAt']).toEqual({ gte: from, lte: to });
    });

    it('maps rows to list items with a resolved service label', async () => {
      prisma.serviceRequest.findMany.mockResolvedValue([
        {
          ...makeRequest(),
          shipParticular: { name: 'MT Portlog' },
          branch: { code: 'PLC' },
          supplier: { name: 'ATM' },
          actualCost: { toNumber: () => 1500.5 },
        },
      ]);
      prisma.serviceRequest.count.mockResolvedValue(1);

      const result = await service.list({ page: 1, pageSize: 25 });

      expect(result.items[0]).toMatchObject({
        controlNumber: 'SN1234/26/PLC',
        vesselName: 'MT Portlog',
        supplierName: 'ATM',
        serviceLabel: 'Berthing (Inbound) (×2)',
        actualCost: 1500.5,
      });
    });
  });
});
