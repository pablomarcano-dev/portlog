import { NominationsService } from '../nominations/nominations.service';
import { Test } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentsService } from '../attachments/attachments.service';

describe('dispatch receipt body', () => {
  it.each([false, true])(
    'records generated-PDF provenance, including storage failure=%s',
    async (storageFails) => {
      let recorded: Record<string, unknown> = {};
      const sentAt = new Date('2026-10-15T16:00:00Z');
      const prisma = {
        pedr: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pedr-1',
            nomination: {
              id: 'nom-1',
              shipParticular: { name: 'MV Test' },
              opPort: { name: 'Jose' },
              branch: { emails: ['branch@example.test'], contactEmails: [], centralEmails: [] },
              nominationClients: [],
              parcels: [],
            },
          }),
        },
        emailDispatch: {
          create: jest
            .fn()
            .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
              recorded = { ...data, id: 'dispatch-1' };
              return recorded;
            }),
          update: jest.fn().mockImplementation(async () => ({ ...recorded, sentAt })),
        },
      };
      const email = { send: jest.fn().mockResolvedValue(undefined) };
      const module = await Test.createTestingModule({
        providers: [
          DispatchService,
          { provide: NominationsService, useValue: { getComposeData: jest.fn() } },
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: email },
          {
            provide: PdfService,
            useValue: { renderSubDocument: jest.fn().mockResolvedValue(Buffer.from('pdf')) },
          },
          {
            provide: StorageService,
            useValue: {
              uploadFile: storageFails
                ? jest.fn().mockRejectedValue(new Error('storage down'))
                : jest.fn().mockResolvedValue(undefined),
            },
          },
          {
            provide: AttachmentsService,
            useValue: {
              resolveForSend: jest.fn().mockResolvedValue([]),
              linkToEmailDispatch: jest.fn().mockResolvedValue(undefined),
            },
          },
        ],
      }).compile();
      const receipt = await module.get(DispatchService).sendSubDocument(
        'pedr-1',
        {
          subDocType: 'ACKNOWLEDGEMENT',
          subject: 'Notice',
          toAddresses: ['client@example.test'],
          ccAddresses: [],
          bccAddresses: [],
          attachmentIds: [],
        },
        'user-1',
      );
      const sentHtml = email.send.mock.calls[0][0].html;
      expect(sentHtml).toContain('MV Test');
      expect(receipt).toEqual(
        expect.objectContaining({
          id: 'dispatch-1',
          bodyHtml: sentHtml,
          generatedPdfExpected: true,
          pdfStorageKey: storageFails ? null : expect.any(String),
          sentAt,
          ccAddresses: ['branch@example.test'],
        }),
      );
      await module.close();
    },
  );
});
