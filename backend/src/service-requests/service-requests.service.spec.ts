import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ServiceRequestsService } from './service-requests.service.js';
import { buildOperationalOrderData } from './order-context.js';

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
    emailAttachment: Record<string, jest.Mock>;
    user: Record<string, jest.Mock>;
    nomination: Record<string, jest.Mock>;
    shipParticular: Record<string, jest.Mock>;
    $transaction: jest.Mock;
  };
  let pdf: { renderTemplate: jest.Mock };
  let storage: Record<string, jest.Mock>;
  let email: { send: jest.Mock };
  let attachments: Record<string, jest.Mock>;
  let operationalOrderDocx: { render: jest.Mock };

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
        count: jest.fn().mockResolvedValue(0),
      },
      emailAttachment: { findUnique: jest.fn() },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'ops@portlog.local',
          displayName: 'Agent One',
        }),
      },
      shipParticular: { findUnique: jest.fn().mockResolvedValue({ id: 'ship-1' }) },
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
    operationalOrderDocx = { render: jest.fn().mockReturnValue(Buffer.from('docx')) };

    service = new ServiceRequestsService(
      prisma as never,
      pdf as never,
      storage as never,
      email as never,
      attachments as never,
      operationalOrderDocx as never,
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

  describe('operational Word order', () => {
    it('generates the supplied form from a saved draft without requiring a PDF or supplier send', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({
          supplierId: null,
          supplier: null,
          nomination: {
            correlative: 42,
            dateNominated: new Date('2026-02-27T00:00:00.000Z'),
            kind: 'SN',
          },
        }),
      );

      const file = await service.downloadOperationalOrderDocx(REQ_ID);

      expect(file.filename).toBe('OC-SN1234-26-PLC.docx');
      expect(operationalOrderDocx.render).toHaveBeenCalledWith(
        expect.objectContaining({
          snOt: 'SN-26/0042',
          orderNumber: 'SN1234/26/PLC',
          vessel: 'MT Portlog',
          supplier: '',
          item1Quantity: '2',
        }),
      );
      expect(pdf.renderTemplate).not.toHaveBeenCalled();
    });

    it('uses the archived Word copy after issue even if reconciliation changes', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SENT',
          issuedDocxKey: 'service-requests/order.docx',
          notes: 'Later note',
        }),
      );
      storage.getFileBuffer.mockResolvedValue(Buffer.from('issued word'));

      const file = await service.downloadOperationalOrderDocx(REQ_ID);

      expect(file.buffer.toString()).toBe('issued word');
      expect(storage.getFileBuffer).toHaveBeenCalledWith('service-requests/order.docx');
      expect(operationalOrderDocx.render).not.toHaveBeenCalled();
    });

    it('does not recreate an older issued Word order from mutable values', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      await expect(service.downloadOperationalOrderDocx(REQ_ID)).rejects.toThrow(ConflictException);
    });

    it('downloads the exact file stored with an earlier dispatch', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      prisma.serviceRequestDispatch.findFirst = jest.fn().mockResolvedValue({
        pdfStorageKey: 'earlier.pdf',
        docxStorageKey: 'earlier.docx',
      });
      await service.downloadDispatchOrder(REQ_ID, 'dispatch-1', 'docx');
      expect(storage.getFileBuffer).toHaveBeenCalledWith('earlier.docx');
    });
  });

  describe('approval and provider receipt', () => {
    it('clears draft approval when supporting documents change', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ approvedAt: SCHEDULED }));
      prisma.serviceRequest.update.mockResolvedValue(makeRequest());
      await service.addDocuments(REQ_ID, ['attachment-1']);
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ approvedById: null, approvedAt: null }),
        }),
      );
    });

    it('records approval only for a manager of the request branch', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());
      prisma.user.findUnique.mockResolvedValue({
        role: 'OPS',
        operationalRole: 'BRANCH_MANAGER',
        branchId: 'branch-1',
        isActive: true,
      });
      prisma.serviceRequest.update.mockResolvedValue(
        makeRequest({
          approvedAt: new Date(),
          approvedBy: { id: 'user-1', email: 'manager@example.com', displayName: 'Manager' },
        }),
      );
      const approved = await service.approve(REQ_ID, 'user-1');
      expect(approved.approvedBy?.displayName).toBe('Manager');
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ approvedById: 'user-1' }) }),
      );
    });

    it('rejects approval from another branch', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest());
      prisma.user.findUnique.mockResolvedValue({
        role: 'OPS',
        operationalRole: 'BRANCH_MANAGER',
        branchId: 'branch-2',
        isActive: true,
      });
      await expect(service.approve(REQ_ID, 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('records receipt after issue without changing the order terms', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      prisma.serviceRequest.update.mockResolvedValue(
        makeRequest({ status: 'SENT', receiptName: 'Provider Rep', receivedAt: SCHEDULED }),
      );
      await service.recordReceipt(
        REQ_ID,
        { receiptName: 'Provider Rep', receivedAt: SCHEDULED },
        'user-1',
      );
      expect(prisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ receiptName: 'Provider Rep', receivedAt: SCHEDULED }),
        }),
      );
    });

    it('rejects an attempt to rewrite recorded provider receipt facts', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({
          status: 'SENT',
          receiptName: 'Original Recipient',
          receiptTitle: null,
          receivedAt: SCHEDULED,
          receiptAttachmentId: null,
        }),
      );
      await expect(
        service.recordReceipt(
          REQ_ID,
          {
            receiptName: 'Different Recipient',
            receivedAt: SCHEDULED,
          },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.serviceRequest.update).not.toHaveBeenCalled();
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
          shipParticularId: 'ship-1',
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

    it('requires a vessel for new transport and other services', async () => {
      await expect(
        service.create(
          {
            type: 'GENERAL',
            nominationId: null,
            shipParticularId: null,
            details: { type: 'GENERAL', route: 'Documents to bank' },
          } as never,
          'user-1',
        ),
      ).rejects.toThrow('Select a vessel');
      expect(prisma.serviceRequest.create).not.toHaveBeenCalled();
    });
  });

  describe('reports', () => {
    it('includes every page while keeping the selected filters', async () => {
      const first = Array.from({ length: 100 }, (_, i) => ({ id: `request-${i}` }));
      const list = jest
        .spyOn(service, 'list')
        .mockResolvedValueOnce({ items: first, total: 101, page: 1, pageSize: 100 } as never)
        .mockResolvedValueOnce({
          items: [{ id: 'request-100' }],
          total: 101,
          page: 2,
          pageSize: 100,
        } as never);
      const report = await service.report({ branchId: 'branch-1', page: 4, pageSize: 25 } as never);
      expect(report.items).toHaveLength(101);
      expect(list).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ branchId: 'branch-1', page: 2, pageSize: 100 }),
      );
      list.mockRestore();
    });
  });

  describe('vessel service workflow', () => {
    it('creates a vessel service without a nomination, using the national sequence', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.serviceRequest.create.mockResolvedValue(makeRequest());
      await service.create(
        {
          type: 'TUG',
          shipParticularId: 'ship-1',
          nominationId: null,
          branchId: 'ignored',
          details: TUG_DETAILS,
          scheduledAt: SCHEDULED,
          currency: 'USD',
          requestedByAuthority: false,
        } as never,
        'user-1',
      );
      expect(prisma.serviceRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shipParticularId: 'ship-1',
            nominationId: null,
            branchId: 'branch-1',
          }),
        }),
      );
      expect(prisma.serviceRequest.create.mock.calls[0][0].data).not.toHaveProperty('correlative');
    });
    it('rejects a nomination belonging to another vessel', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findFirst.mockResolvedValue({
        id: 'nom-1',
        shipParticularId: 'other-ship',
        branchId: 'branch-1',
      });
      await expect(
        service.create(
          {
            type: 'TUG',
            shipParticularId: 'ship-1',
            nominationId: 'nom-1',
            details: TUG_DETAILS,
          } as never,
          'user-1',
        ),
      ).rejects.toThrow('another vessel');
    });
    it('requires authority documentation for a tug when explicitly requested', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ requestedByAuthority: true, requestingAuthority: 'INEA', documents: [] }),
      );
      await expect(service.generateOrderPdf(REQ_ID)).rejects.toThrow('authorisation');
      expect(pdf.renderTemplate).not.toHaveBeenCalled();
    });
    it('permits a non-authority service without an authority letter', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ requestedByAuthority: false, documents: [] }),
      );
      prisma.serviceRequest.update.mockResolvedValue(makeRequest());
      await expect(service.generateOrderPdf(REQ_ID)).resolves.toHaveProperty('minioKey');
    });
  });

  describe('nominationOptions', () => {
    const optionRow = (kind = 'SN', correlative = 1234) => ({
      id: `${kind}-${correlative}`,
      kind,
      correlative,
      dateNominated: new Date('2026-06-01T12:00:00Z'),
      voyageNumber: 'TRIP-ALPHA-99',
      shipParticularId: 'vessel-1',
      shipParticular: { name: 'Nordic Pearl' },
      branchId: 'branch-1',
      branch: { name: 'Branch One' },
    });

    it.each(['SN', 'sn-26/', '26/12', '123', '234', 'SN-26/1234', 'nordic', 'PEAR', 'alpha'])(
      'finds SN by partial reference, vessel or voyage: %s',
      async (query) => {
        prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
        prisma.nomination.findMany.mockResolvedValue([optionRow()]);
        const result = await service.nominationOptions('user-1', query);
        expect(result.map((item) => item.reference)).toEqual(['SN-26/1234']);
      },
    );

    it.each(['OT', 'ot-26/', '26/12', '123', '234'])(
      'finds OT by partial reference: %s',
      async (query) => {
        prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
        prisma.nomination.findMany.mockResolvedValue([optionRow('OT')]);
        expect(await service.nominationOptions('user-1', query)).toHaveLength(1);
      },
    );

    it('filters before limiting and does not return unrelated references', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findMany.mockResolvedValue([
        ...Array.from({ length: 100 }, (_, i) => optionRow('OT', i + 1)),
        optionRow('SN', 1234),
      ]);
      expect(
        (await service.nominationOptions('user-1', 'SN-26/12')).map((item) => item.id),
      ).toEqual(['SN-1234']);
    });

    it('limits selectable records to the signed-in user branch and excludes cancelled records', async () => {
      prisma.user.findUnique.mockResolvedValue({ branchId: 'branch-1' });
      prisma.nomination.findMany.mockResolvedValue([]);
      await service.nominationOptions('user-1', 'Nordic');
      expect(prisma.nomination.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { branchId: 'branch-1', status: { not: 'CANCELLED' } },
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
      await expect(
        service.update(REQ_ID, { notes: 'Changed provider instructions' }),
      ).rejects.toThrow(ConflictException);
    });

    it('still accepts the reconciliation fields after send', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(makeRequest({ status: 'SENT' }));
      prisma.serviceRequest.update.mockResolvedValue(
        makeRequest({ status: 'SENT', physicalVoucherNo: '6009' }),
      );

      const result = await service.update(REQ_ID, {
        physicalVoucherNo: '6009',
        reconciliationNotes: 'Invoice received',
      });

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
      expect(storage.uploadFile).toHaveBeenCalledWith(
        expect.stringContaining('/orden-operativa-'),
        Buffer.from('docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      );
    });

    it('keeps a PDF referenced by an earlier dispatch during resend', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({ status: 'SENT', minioKey: 'earlier.pdf' }),
      );
      prisma.serviceRequestDispatch.count.mockResolvedValue(1);
      await service.sendOrder(REQ_ID, sendDto as never, 'user-1');
      expect(storage.deleteFile).not.toHaveBeenCalledWith('earlier.pdf');
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

    it('copies every branch email list on the order dispatch', async () => {
      prisma.serviceRequest.findUnique.mockResolvedValue(
        makeRequest({
          branch: {
            id: 'branch-1',
            name: 'Puerto La Cruz',
            code: 'PLC',
            emails: ['plc@example.com'],
            contactEmails: ['manager@example.com'],
            centralEmails: ['hq@example.com', 'EXISTING@example.com'],
          },
        }),
      );

      await service.sendOrder(
        REQ_ID,
        { ...sendDto, ccAddresses: ['existing@example.com'] } as never,
        'user-1',
      );

      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          cc: ['existing@example.com', 'plc@example.com', 'manager@example.com', 'hq@example.com'],
        }),
      );
      expect(prisma.serviceRequestDispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ccAddresses: [
              'existing@example.com',
              'plc@example.com',
              'manager@example.com',
              'hq@example.com',
            ],
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

describe('operational Word field mapping', () => {
  it('uses one service item and maps the request-specific order fields', () => {
    const data = buildOperationalOrderData(
      makeRequest({
        originPoint: 'Pilot jetty',
        destinationPoint: 'Vessel at anchorage',
        contactPersonName: 'María López',
        operationDescription: 'Atraque con remolcadores',
        approvedBy: { email: 'manager@example.com', displayName: 'Branch Manager' },
        approvedAt: SCHEDULED,
      }) as never,
    );
    expect(data).toMatchObject({
      departure: 'Pilot jetty',
      destination: 'Vessel at anchorage',
      contact: 'María López',
      operation: 'Atraque con remolcadores',
      item1Description: 'Atraque con remolcadores',
      item1Quantity: '2',
      item2Description: '',
      approver: 'Branch Manager',
    });
    expect(data.observations).toContain('Tipo de Operación');
  });
});
