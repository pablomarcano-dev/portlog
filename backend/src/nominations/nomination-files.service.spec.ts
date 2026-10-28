import { NominationFilesService } from './nomination-files.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { AttachmentsCleanupCron } from '../attachments/attachments-cleanup.cron.js';
import { StorageService } from '../storage/storage.service.js';

function fixture() {
  const prisma = {
    nomination: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'nom', opPort: { id: 'port', name: 'Terminal A' } }),
    },
    port: { findUnique: jest.fn().mockResolvedValue({ id: 'port' }) },
    emailAttachment: {
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn(),
    },
    emailDispatch: { findMany: jest.fn().mockResolvedValue([]) },
    shDocumentDispatch: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const attachments = {
    upload: jest.fn().mockResolvedValue({ id: 'generated-pdf' }),
    storedPdf: jest.fn().mockResolvedValue({ content: Buffer.from('%PDF-saved') }),
  };
  const pdf = { renderHtml: jest.fn().mockResolvedValue(Buffer.from('%PDF-rendered')) };
  const service = new NominationFilesService(
    prisma as unknown as PrismaService,
    attachments as unknown as AttachmentsService,
    pdf as unknown as PdfService,
  );
  return { prisma, attachments, pdf, service };
}
const record = {
  id: 'message',
  subDocType: 'ETA_TERMINAL',
  subject: '<ETA>',
  sentAt: new Date('2026-10-22T12:00:00Z'),
  bodyHtml: '<p>Archived ETA 10:00</p>',
  pdfStorageKey: null,
  toAddresses: ['terminal@example.test'],
  ccAddresses: ['branch@example.test'],
  attachments: [
    { id: 'old-file', filename: 'nor.pdf', mimeType: 'application/pdf', sizeBytes: 20 },
  ],
};

describe('nomination saved documents', () => {
  it('lists only the selected terminal’s active materials', async () => {
    const f = fixture();
    await f.service.prearrivalFiles('nom');
    expect(f.prisma.emailAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { terminalPortId: 'port', terminalRetiredAt: null } }),
    );
  });
  it('returns an honest empty terminal selection instead of falling back to another terminal', async () => {
    const f = fixture();
    f.prisma.nomination.findUnique.mockResolvedValue({ id: 'nom', opPort: null });
    expect(await f.service.prearrivalFiles('nom')).toEqual({ terminal: null, files: [] });
    expect(f.prisma.emailAttachment.findMany).not.toHaveBeenCalled();
  });
  it('atomically files only the current uploader’s unowned unsent upload', async () => {
    const f = fixture();
    await f.service.fileAtTerminal('port', 'file', 'uploader');
    expect(f.prisma.emailAttachment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'file',
          uploadedById: 'uploader',
          terminalPortId: null,
          emailDispatchId: null,
          serviceRequestId: null,
          serviceRequestReceipt: { is: null },
        }),
        data: { terminalPortId: 'port' },
      }),
    );
    f.prisma.emailAttachment.updateMany.mockResolvedValue({ count: 0 });
    await expect(f.service.fileAtTerminal('port', 'file', 'other')).rejects.toThrow(
      'unsent upload',
    );
  });
  it('retires library materials without deleting their row or bytes', async () => {
    const f = fixture();
    await f.service.retireTerminalFile('port', 'file');
    expect(f.prisma.emailAttachment.updateMany).toHaveBeenCalledWith({
      where: { id: 'file', terminalPortId: 'port', terminalRetiredAt: null },
      data: { terminalRetiredAt: expect.any(Date) },
    });
  });
  it('protects active and retired terminal files from staged cleanup', async () => {
    const f = fixture();
    const storage = { deleteFile: jest.fn() };
    const cron = new AttachmentsCleanupCron(
      f.prisma as unknown as PrismaService,
      storage as unknown as StorageService,
    );
    await cron.purgeStaged();
    expect(f.prisma.emailAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ terminalPortId: null }) }),
    );
    expect(storage.deleteFile).not.toHaveBeenCalled();
  });
  it('offers saved ETA/NOR records and attachments, excluding unrelated message types', async () => {
    const f = fixture();
    f.prisma.emailDispatch.findMany.mockResolvedValue([
      record,
      { ...record, id: 'sof', subDocType: 'SOF' },
    ]);
    const result = await f.service.recapFiles('nom');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'message',
      canCreatePdf: true,
      attachments: record.attachments,
    });
    expect(f.prisma.emailDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { pedr: { nominationId: 'nom' }, sentAt: { not: null } } }),
    );
  });
  it('renders the archived email with scripts/network disabled and escapes metadata', async () => {
    const f = fixture();
    f.prisma.emailDispatch.findMany.mockResolvedValue([record]);
    await f.service.recapPdf('nom', 'PEDR_DISPATCH', 'message', 'agent');
    expect(f.pdf.renderHtml).toHaveBeenCalledWith(
      expect.stringContaining('Subject: &lt;ETA&gt;'),
      true,
    );
    expect(f.pdf.renderHtml).toHaveBeenCalledWith(
      expect.stringContaining('Archived ETA 10:00'),
      true,
    );
    expect(f.attachments.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-rendered'),
      }),
      'agent',
    );
  });
  it('reuses a stored original PDF without recomposing or overwriting it', async () => {
    const f = fixture();
    f.prisma.emailDispatch.findMany.mockResolvedValue([
      { ...record, pdfStorageKey: 'archive/original.pdf' },
    ]);
    await f.service.recapPdf('nom', 'PEDR_DISPATCH', 'message', 'agent');
    expect(f.attachments.storedPdf).toHaveBeenCalledWith(
      'archive/original.pdf',
      expect.any(String),
    );
    expect(f.pdf.renderHtml).not.toHaveBeenCalled();
  });
  it('rejects another nomination’s record instead of rendering a guessed document', async () => {
    const f = fixture();
    await expect(f.service.recapPdf('other', 'PEDR_DISPATCH', 'message', 'agent')).rejects.toThrow(
      'not found',
    );
    expect(f.attachments.upload).not.toHaveBeenCalled();
  });
  it('reports missing historical content instead of inventing a PDF', async () => {
    const f = fixture();
    f.prisma.emailDispatch.findMany.mockResolvedValue([{ ...record, bodyHtml: null }]);
    expect((await f.service.recapFiles('nom'))[0].canCreatePdf).toBe(false);
    await expect(f.service.recapPdf('nom', 'PEDR_DISPATCH', 'message', 'agent')).rejects.toThrow(
      'no saved PDF',
    );
  });
});
