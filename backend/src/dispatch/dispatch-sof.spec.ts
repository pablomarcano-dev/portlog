import { Test } from '@nestjs/testing';
import * as fs from 'node:fs';
import * as path from 'node:path';
import Handlebars from 'handlebars';
import { DispatchService } from './dispatch.service';
import { NominationsService } from '../nominations/nominations.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { PdfService } from '../pdf/pdf.service';
import { StorageService } from '../storage/storage.service';
import { AttachmentsService } from '../attachments/attachments.service';

describe('SOF dispatch content and classification', () => {
  it.each(['SOF', 'SOF_INTERIM'] as const)(
    'renders the same selected canonical content in email and PDF and archives %s',
    async (subDocType) => {
      const canonical =
        'Safe Key Meeting Completed\nQty. Requested (BBLS/HR): 900\nFrom: Surveyor — To: Master — Letter < &\nFm 2026-10-26 10:00 To 2026-10-26 12:00 Awaiting';
      const prisma = {
        pedr: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pedr-1',
            nomination: {
              id: 'nom-1',
              shipParticular: { name: 'QA Vessel' },
              branch: { emails: ['branch@example.test', 'to@example.test'] },
              alwaysCopyGroup: {
                id: 'copy',
                name: 'Always copy',
                members: [{ email: 'copy@example.test' }, { email: 'TO@example.test' }],
              },
              nominationClients: [],
              parcels: [],
            },
          }),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ email: 'agent@example.test' }) },
        emailDispatch: {
          count: jest.fn().mockResolvedValue(0),
          create: jest
            .fn()
            .mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
              ...data,
              id: 'dispatch-1',
            })),
          update: jest.fn().mockResolvedValue({ id: 'dispatch-1', sentAt: new Date() }),
        },
      };
      const nominations = { getComposeData: jest.fn().mockResolvedValue({ bodyText: canonical }) };
      const pdf = { renderSubDocument: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
      const email = { send: jest.fn().mockResolvedValue(undefined) };
      const module = await Test.createTestingModule({
        providers: [
          DispatchService,
          { provide: PrismaService, useValue: prisma },
          { provide: NominationsService, useValue: nominations },
          { provide: PdfService, useValue: pdf },
          { provide: EmailService, useValue: email },
          {
            provide: StorageService,
            useValue: { uploadFile: jest.fn().mockResolvedValue(undefined) },
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
      await module.get(DispatchService).sendSubDocument(
        'pedr-1',
        {
          subDocType,
          subject: 'QA SOF',
          toAddresses: ['to@example.test'],
          ccAddresses: [],
          bccAddresses: [],
          attachmentIds: [],
        },
        'user-1',
      );
      expect(nominations.getComposeData).toHaveBeenCalledWith(
        'nom-1',
        subDocType,
        'agent@example.test',
      );
      expect(pdf.renderSubDocument).toHaveBeenCalledWith(
        'SOF',
        expect.objectContaining({
          sofBody: canonical,
          sofTitle:
            subDocType === 'SOF' ? 'FINAL STATEMENT OF FACTS' : 'INTERIM STATEMENT OF FACTS',
        }),
      );
      expect(prisma.emailDispatch.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ subDocType }) }),
      );
      expect(email.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: ['to@example.test'],
          cc: ['copy@example.test', 'branch@example.test'],
        }),
      );
      expect(prisma.emailDispatch.count).toHaveBeenCalledWith({
        where: { pedrId: 'pedr-1', subDocType, sentAt: { not: null } },
      });
      const data = pdf.renderSubDocument.mock.calls[0]![1] as Record<string, unknown>;
      const html = Handlebars.compile(
        fs.readFileSync(path.join(process.cwd(), 'src/pdf/templates/sof.hbs'), 'utf8'),
      )(data);
      expect(html).toContain('Letter &lt; &amp;');
      expect(html).toContain('Safe Key Meeting Completed');
      expect(html).not.toContain('No events recorded');
      expect(email.send.mock.calls[0]![0].html).toContain('Qty. Requested (BBLS/HR): 900');
      await module.close();
    },
  );
});
