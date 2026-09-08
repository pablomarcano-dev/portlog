import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SHDocumentsController } from '../sh-documents/sh-documents.controller.js';
import { SHDocumentsService } from '../sh-documents/sh-documents.service.js';
import { BranchDocumentsController } from '../branch-documents/branch-documents.controller.js';
import { BranchDocumentsService } from '../branch-documents/branch-documents.service.js';

// Use the actual HTTP adapter: a mocked Express-like reply would hide this regression.
describe('Document downloads over Fastify', () => {
  let app: NestFastifyApplication;
  const downloadPdf = jest.fn();
  const nominationId = '0559318d-78de-4538-852b-88f4bdfe8c42';
  const documentId = '14818f23-f311-45fe-95cd-4860c94ad8dd';
  const pdf = Buffer.from('%PDF-1.7\n\x00\xff\n%%EOF', 'latin1');

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SHDocumentsController, BranchDocumentsController],
      providers: [
        { provide: SHDocumentsService, useValue: { downloadPdf } },
        { provide: BranchDocumentsService, useValue: { downloadPdf } },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix('api');
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => downloadPdf.mockReset());

  describe.each(['sh-documents', 'branch-documents'])('%s', (resource) => {
    const url = `/api/nominations/${nominationId}/${resource}/${documentId}/download`;

    it('returns the PDF bytes and inline download headers', async () => {
      downloadPdf.mockResolvedValue({ buffer: pdf, filename: 'document.pdf' });
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toBe('inline; filename="document.pdf"');
      expect(response.rawPayload).toEqual(pdf);
      expect(downloadPdf).toHaveBeenCalledWith(nominationId, documentId);
    });

    it('preserves a missing-document error', async () => {
      downloadPdf.mockRejectedValue(new NotFoundException('Document not found'));
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(404);
      expect(response.json().message).toBe('Document not found');
    });
  });
});
