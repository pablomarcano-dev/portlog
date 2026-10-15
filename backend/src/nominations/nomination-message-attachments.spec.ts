import { NominationsService } from './nominations.service.js';

describe('nomination message attachment history', () => {
  it('returns stored attachment metadata for both dispatch sources without modifying evidence', async () => {
    const attachment = {
      id: 'attachment-1',
      filename: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 20,
    };
    const base = {
      id: 'dispatch-1',
      subject: 'Test',
      toAddresses: ['master@example.com'],
      ccAddresses: [],
      sentAt: new Date('2026-10-05T12:00:00Z'),
      createdAt: new Date('2026-10-05T12:00:00Z'),
      error: null,
      bodyHtml: '<p>Message</p>',
      sentBy: { id: 'user-1', email: 'operator@example.com' },
      attachments: [attachment],
    };
    const prisma = {
      nomination: { findUnique: jest.fn().mockResolvedValue({ id: 'nomination-1' }) },
      emailDispatch: {
        findMany: jest.fn().mockResolvedValue([{ ...base, subDocType: 'ETA_REPLY' }]),
      },
      shDocumentDispatch: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ ...base, id: 'dispatch-2', shDocument: { type: 'SH_09A' } }]),
      },
    };
    const service = new NominationsService(prisma as never, {} as never, {} as never, {} as never);
    const result = await service.getNominationMessages('nomination-1');
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.attachments)).toEqual([[attachment], [attachment]]);
    expect(prisma.emailDispatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pedr: { nominationId: 'nomination-1' } },
        include: expect.objectContaining({
          attachments: expect.objectContaining({
            select: { id: true, filename: true, mimeType: true, sizeBytes: true },
          }),
        }),
      }),
    );
  });
});
