import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AttachmentsService } from './attachments.service.js';
import { MAX_TOTAL_ATTACHMENTS_BYTES } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Mocks — Prisma + Storage
// ---------------------------------------------------------------------------

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'att-1',
  minioKey: 'email-attachments/uuid/report.pdf',
  filename: 'report.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 1234,
  uploadedById: 'user-1',
  createdAt: new Date('2026-07-20T00:00:00Z'),
  emailDispatchId: null,
  shDocumentDispatchId: null,
  ...overrides,
});

let prismaMock: {
  emailAttachment: {
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    delete: jest.Mock;
    deleteMany: jest.Mock;
    updateMany: jest.Mock;
  };
};
let storageMock: {
  uploadFile: jest.Mock;
  getFileBuffer: jest.Mock;
  deleteFile: jest.Mock;
};
let service: AttachmentsService;

beforeEach(() => {
  prismaMock = {
    emailAttachment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  storageMock = {
    uploadFile: jest.fn().mockResolvedValue(undefined),
    getFileBuffer: jest.fn(),
    deleteFile: jest.fn().mockResolvedValue(undefined),
  };
  service = new AttachmentsService(prismaMock as never, storageMock as never);
});

// ---------------------------------------------------------------------------
// upload
// ---------------------------------------------------------------------------

describe('AttachmentsService.upload', () => {
  it('rejects an unsupported MIME type before touching storage', async () => {
    await expect(
      service.upload(
        { filename: 'evil.exe', mimeType: 'application/x-msdownload', buffer: Buffer.from('x') },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(storageMock.uploadFile).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    await expect(
      service.upload(
        { filename: 'empty.pdf', mimeType: 'application/pdf', buffer: Buffer.alloc(0) },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uploads to storage and records a staged row', async () => {
    prismaMock.emailAttachment.create.mockResolvedValue(makeRow());
    const res = await service.upload(
      { filename: 'report.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') },
      'user-1',
    );

    expect(storageMock.uploadFile).toHaveBeenCalledTimes(1);
    const [key, buf, mime] = storageMock.uploadFile.mock.calls[0];
    expect(key).toMatch(/^email-attachments\/.+\/report\.pdf$/);
    expect(buf).toBeInstanceOf(Buffer);
    expect(mime).toBe('application/pdf');
    expect(res).toMatchObject({ id: 'att-1', filename: 'report.pdf', mimeType: 'application/pdf' });
  });

  it('strips directory components from the filename', async () => {
    prismaMock.emailAttachment.create.mockResolvedValue(makeRow());
    await service.upload(
      { filename: '../../etc/passwd.txt', mimeType: 'text/plain', buffer: Buffer.from('x') },
      'user-1',
    );
    const createArg = prismaMock.emailAttachment.create.mock.calls[0][0];
    expect(createArg.data.filename).toBe('passwd.txt');
  });
});

// ---------------------------------------------------------------------------
// resolveForSend
// ---------------------------------------------------------------------------

describe('AttachmentsService.resolveForSend', () => {
  it('returns [] for an empty id list without querying', async () => {
    const res = await service.resolveForSend([]);
    expect(res).toEqual([]);
    expect(prismaMock.emailAttachment.findMany).not.toHaveBeenCalled();
  });

  it('throws when an id no longer exists', async () => {
    prismaMock.emailAttachment.findMany.mockResolvedValue([makeRow({ id: 'att-1' })]);
    await expect(service.resolveForSend(['att-1', 'missing'])).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects when the combined size exceeds the per-email cap', async () => {
    const half = Math.ceil(MAX_TOTAL_ATTACHMENTS_BYTES / 2) + 1;
    prismaMock.emailAttachment.findMany.mockResolvedValue([
      makeRow({ id: 'a', sizeBytes: half }),
      makeRow({ id: 'b', sizeBytes: half }),
    ]);
    await expect(service.resolveForSend(['a', 'b'])).rejects.toBeInstanceOf(
      PayloadTooLargeException,
    );
    expect(storageMock.getFileBuffer).not.toHaveBeenCalled();
  });

  it('resolves buffers in caller order and de-duplicates', async () => {
    prismaMock.emailAttachment.findMany.mockResolvedValue([
      makeRow({ id: 'b', filename: 'b.pdf', minioKey: 'k/b' }),
      makeRow({ id: 'a', filename: 'a.pdf', minioKey: 'k/a' }),
    ]);
    storageMock.getFileBuffer.mockImplementation((key: string) =>
      Promise.resolve(Buffer.from(key)),
    );

    const res = await service.resolveForSend(['a', 'b', 'a']);
    expect(res.map((r) => r.filename)).toEqual(['a.pdf', 'b.pdf']);
    expect(prismaMock.emailAttachment.findMany).toHaveBeenCalledTimes(1);
    // de-duped to 2 unique ids
    expect(prismaMock.emailAttachment.findMany.mock.calls[0][0].where.id.in).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe('AttachmentsService.delete', () => {
  it('404s when the attachment is missing', async () => {
    prismaMock.emailAttachment.findUnique.mockResolvedValue(null);
    await expect(service.delete('nope', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('409s when the attachment was already sent (linked)', async () => {
    prismaMock.emailAttachment.findUnique.mockResolvedValue(makeRow({ emailDispatchId: 'disp-1' }));
    await expect(service.delete('att-1', 'user-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.emailAttachment.delete).not.toHaveBeenCalled();
  });

  it('deletes a staged attachment (object + row)', async () => {
    prismaMock.emailAttachment.findUnique.mockResolvedValue(makeRow());
    prismaMock.emailAttachment.delete.mockResolvedValue(makeRow());
    await service.delete('att-1', 'user-1');
    expect(storageMock.deleteFile).toHaveBeenCalledWith('email-attachments/uuid/report.pdf');
    expect(prismaMock.emailAttachment.delete).toHaveBeenCalledWith({ where: { id: 'att-1' } });
  });
});

// ---------------------------------------------------------------------------
// linking
// ---------------------------------------------------------------------------

describe('AttachmentsService linking', () => {
  it('links ids to an email dispatch', async () => {
    prismaMock.emailAttachment.updateMany.mockResolvedValue({ count: 2 });
    await service.linkToEmailDispatch(['a', 'b'], 'disp-1');
    expect(prismaMock.emailAttachment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b'] } },
      data: { emailDispatchId: 'disp-1' },
    });
  });

  it('no-ops on an empty id list', async () => {
    await service.linkToShDocumentDispatch([], 'shd-1');
    expect(prismaMock.emailAttachment.updateMany).not.toHaveBeenCalled();
  });
});
