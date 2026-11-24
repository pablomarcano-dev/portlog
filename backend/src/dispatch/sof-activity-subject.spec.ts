import { DispatchService } from './dispatch.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { EmailService } from '../email/email.service.js';
import type { PdfService } from '../pdf/pdf.service.js';
import type { StorageService } from '../storage/storage.service.js';
import type { AttachmentsService } from '../attachments/attachments.service.js';
import type { NominationsService } from '../nominations/nominations.service.js';

describe('SOF activity subject send validation', () => {
  const dto = {
    subDocType: 'SOF_INTERIM' as const,
    toAddresses: ['ops@example.com'],
    ccAddresses: [],
    bccAddresses: [],
    subject: 'FOREVER :: forged suffix',
    attachmentIds: [],
    sofSubjectActivityId: 'pilot',
  };
  function fixture(active = true) {
    const prisma = {
      pedr: { findUnique: jest.fn(async () => ({ id: 'pedr', nomination: { id: 'nom' } })) },
      sofSubjectActivity: {
        findUnique: jest.fn(async () => ({ label: 'Pilot On Board', active })),
      },
    };
    const mail = { send: jest.fn() };
    const pdf = { render: jest.fn() };
    const svc = new DispatchService(
      prisma as unknown as PrismaService,
      mail as unknown as EmailService,
      pdf as unknown as PdfService,
      {} as StorageService,
      {} as AttachmentsService,
      {} as NominationsService,
    );
    return { svc, prisma, mail, pdf };
  }
  it('rejects inactive label before creating a dispatch or sending mail', async () => {
    const { svc, mail } = fixture(false);
    await expect(svc.sendSubDocument('pedr', dto, 'user')).rejects.toThrow('Choose an active');
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('rejects stale or edited labels rather than silently changing the composed subject', async () => {
    const { svc, mail } = fixture();
    await expect(svc.sendSubDocument('pedr', dto, 'user')).rejects.toThrow(
      'activity label changed',
    );
    expect(mail.send).not.toHaveBeenCalled();
  });
  it('rejects activity labels for non-SOF document types', async () => {
    const { svc, mail } = fixture();
    await expect(
      svc.sendSubDocument('pedr', { ...dto, subDocType: 'PREARRIVAL' }, 'user'),
    ).rejects.toThrow('only for SOF');
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe('canonical SOF activity delivery', () => {
  it('snapshots the selected active label on the stored dispatch and actual email', async () => {
    const create = jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      ...data,
      id: 'sent',
    }));
    const prisma = {
      pedr: {
        findUnique: jest.fn(async () => ({
          id: 'pedr',
          nomination: {
            id: 'nom',
            shipParticular: { name: 'FOREVER' },
            branch: { emails: [] },
            parcels: [],
            nominationClients: [],
          },
        })),
      },
      user: { findUnique: jest.fn(async () => ({ email: 'agent@example.com' })) },
      sofSubjectActivity: {
        findUnique: jest.fn(async () => ({ label: 'Pilot On Board', active: true })),
      },
      emailDispatch: {
        count: jest.fn(async () => 0),
        create,
        update: jest.fn(async () => ({ id: 'sent', sentAt: new Date() })),
      },
    };
    const send = jest.fn(async () => undefined);
    const svc = new DispatchService(
      prisma as unknown as PrismaService,
      { send } as unknown as EmailService,
      { renderSubDocument: jest.fn(async () => Buffer.from('pdf')) } as unknown as PdfService,
      { uploadFile: jest.fn(async () => undefined) } as unknown as StorageService,
      {
        resolveForSend: jest.fn(async () => []),
        linkToEmailDispatch: jest.fn(async () => undefined),
      } as unknown as AttachmentsService,
      {
        getComposeData: jest.fn(async () => ({ bodyText: 'Recorded SOF content' })),
      } as unknown as NominationsService,
    );
    await svc.sendSubDocument(
      'pedr',
      {
        subDocType: 'SOF_INTERIM',
        toAddresses: ['ops@example.com'],
        ccAddresses: [],
        bccAddresses: [],
        subject: 'FOREVER SN3092/26/MBO - Interim Statement of Facts',
        attachmentIds: [],
        sofSubjectActivityId: 'pilot',
      },
      'user',
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subject: 'FOREVER SN3092/26/MBO :: Pilot On Board' }),
      }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'FOREVER SN3092/26/MBO :: Pilot On Board' }),
    );
    // The stored text is a snapshot; it has no live catalog-label relation to rewrite on edits.
    expect(create.mock.calls[0]![0].data).not.toHaveProperty('sofSubjectActivity');
  });
});
