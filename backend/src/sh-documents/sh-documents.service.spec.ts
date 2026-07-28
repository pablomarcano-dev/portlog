import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SHDocumentsService } from './sh-documents.service.js';

const makeSHDoc = (overrides: Record<string, unknown> = {}) => ({
  id: 'doc-uuid',
  nominationId: 'nom-uuid',
  type: 'SH_66A',
  status: 'DRAFT',
  title: null,
  data: { rows: [{ date: '2026-05-22', from: '08:00', to: '10:00', activity: 'Loading' }] },
  minioKey: null,
  pdfGeneratedAt: null,
  sentAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  createdBy: { id: 'user-1', email: 'ops@portlog.local' },
  ...overrides,
});

describe('SHDocumentsService FSM', () => {
  let service: SHDocumentsService;
  let prismaMock: Record<string, unknown>;
  let pdfMock: Record<string, unknown>;
  let storageMock: Record<string, unknown>;
  let attachmentsMock: Record<string, unknown>;

  beforeEach(() => {
    prismaMock = {
      sHDocument: {
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      nomination: {
        findUnique: jest.fn().mockResolvedValue({ id: 'nom-uuid' }),
      },
    };
    pdfMock = { renderTemplate: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    storageMock = {
      uploadFile: jest.fn(),
      getPresignedUrl: jest.fn().mockResolvedValue('https://minio/url'),
      getFileBuffer: jest.fn().mockResolvedValue(Buffer.from('pdf')),
      deleteFile: jest.fn(),
    };
    attachmentsMock = {
      resolveForSend: jest.fn().mockResolvedValue([]),
      linkToShDocumentDispatch: jest.fn().mockResolvedValue(undefined),
    };
    service = new SHDocumentsService(
      prismaMock as never,
      pdfMock as never,
      storageMock as never,
      attachmentsMock as never,
    );
  });

  it('finalize: DRAFT → FINALIZED succeeds', async () => {
    const doc = makeSHDoc();
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    (prismaMock.sHDocument as Record<string, unknown>).update = jest
      .fn()
      .mockResolvedValue({ ...doc, status: 'FINALIZED' });
    const result = await service.finalize('nom-uuid', 'doc-uuid');
    expect(result.status).toBe('FINALIZED');
  });

  it('finalize: SENT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'SENT' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('finalize: already FINALIZED → throws 409', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update: SENT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'SENT' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.update('nom-uuid', 'doc-uuid', { data: {} })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update: FINALIZED → throws 403', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.update('nom-uuid', 'doc-uuid', { data: {} })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('finalize: COMMENT → throws 400', async () => {
    const doc = makeSHDoc({ type: 'COMMENT', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('finalize: OTHER → throws 400', async () => {
    const doc = makeSHDoc({ type: 'OTHER', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('generatePdf: COMMENT → throws 400', async () => {
    const doc = makeSHDoc({ type: 'COMMENT', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.generatePdf('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delete: non-DRAFT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest.fn().mockResolvedValue(doc);
    await expect(service.delete('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne: missing doc → throws 404', async () => {
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = jest
      .fn()
      .mockResolvedValue(null);
    await expect(service.findOne('nom-uuid', 'no-such-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
