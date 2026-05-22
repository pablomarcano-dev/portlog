import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  beforeEach(() => {
    prismaMock = {
      sHDocument: {
        findFirst: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      nomination: {
        findUnique: vi.fn().mockResolvedValue({ id: 'nom-uuid' }),
      },
    };
    pdfMock = { renderTemplate: vi.fn().mockResolvedValue(Buffer.from('pdf')) };
    storageMock = {
      uploadFile: vi.fn(),
      getPresignedUrl: vi.fn().mockResolvedValue('https://minio/url'),
      deleteFile: vi.fn(),
    };
    service = new SHDocumentsService(prismaMock as never, pdfMock as never, storageMock as never);
  });

  it('finalize: DRAFT → FINALIZED succeeds', async () => {
    const doc = makeSHDoc();
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    (prismaMock.sHDocument as Record<string, unknown>).update = vi
      .fn()
      .mockResolvedValue({ ...doc, status: 'FINALIZED' });
    const result = await service.finalize('nom-uuid', 'doc-uuid');
    expect(result.status).toBe('FINALIZED');
  });

  it('finalize: SENT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'SENT' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('finalize: already FINALIZED → throws 409', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update: SENT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'SENT' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.update('nom-uuid', 'doc-uuid', { data: {} })).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('update: FINALIZED → throws 403', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.update('nom-uuid', 'doc-uuid', { data: {} })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('finalize: COMMENT → throws 400', async () => {
    const doc = makeSHDoc({ type: 'COMMENT', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('finalize: OTHER → throws 400', async () => {
    const doc = makeSHDoc({ type: 'OTHER', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.finalize('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('generatePdf: COMMENT → throws 400', async () => {
    const doc = makeSHDoc({ type: 'COMMENT', data: { html: '<p>hi</p>' } });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.generatePdf('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delete: non-DRAFT → throws 409', async () => {
    const doc = makeSHDoc({ status: 'FINALIZED' });
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(doc);
    await expect(service.delete('nom-uuid', 'doc-uuid')).rejects.toBeInstanceOf(ConflictException);
  });

  it('findOne: missing doc → throws 404', async () => {
    (prismaMock.sHDocument as Record<string, unknown>).findFirst = vi.fn().mockResolvedValue(null);
    await expect(service.findOne('nom-uuid', 'no-such-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
