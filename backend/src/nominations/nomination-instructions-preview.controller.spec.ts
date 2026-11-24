import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { AdministrativeNominationInstructionsService } from './administrative-nomination-instructions.service';
import { DocxPreviewService } from './docx-preview.service';
import { NominationsService } from './nominations.service';
import { NominationInstructionsPreviewController } from './nomination-instructions-preview.controller';

describe('instruction preview HTTP contract', () => {
  const id = '6039ed24-664e-48ed-8ca9-a0acc7419d83';
  const secret = 'instruction-preview-local-test-secret';
  const operational = {
    buffer: Buffer.from('operational docx bytes'),
    filename: 'operational.docx',
  };
  const administrative = {
    buffer: Buffer.from('administrative docx bytes'),
    filename: 'SN3092-26-MBO.docx',
  };
  const generateOperational = jest.fn().mockResolvedValue(operational);
  const generateAdministrative = jest.fn().mockResolvedValue(administrative);
  const convert = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.7\npreview'));
  let app: NestFastifyApplication;
  let adapter: FastifyAdapter;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [NominationInstructionsPreviewController],
      providers: [
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        {
          provide: NominationsService,
          useValue: { generateNominationInstructions: generateOperational },
        },
        {
          provide: AdministrativeNominationInstructionsService,
          useValue: { generate: generateAdministrative },
        },
        { provide: DocxPreviewService, useValue: { convert } },
      ],
    }).compile();
    adapter = new FastifyAdapter();
    app = module.createNestApplication<NestFastifyApplication>(adapter);
    await app.init();
    await adapter.getInstance().ready();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['nomination-instructions.pdf', operational],
    ['administrative-nomination-instructions.pdf', administrative],
  ])(
    'authenticates %s and converts the same bytes as the Word generator',
    async (suffix, document) => {
      const server = adapter.getInstance();
      const url = `/nominations/${id}/${suffix}`;
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
      expect(convert).not.toHaveBeenCalled();
      const token = new JwtService({ secret }).sign({ sub: 'operator', role: 'OPS' });
      const response = await server.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/pdf');
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-disposition']).toContain('inline;');
      expect(response.headers['content-disposition']).toContain(
        encodeURIComponent(document.filename.replace(/\.docx$/, '.pdf')),
      );
      expect(convert).toHaveBeenCalledWith(document.buffer);
      expect(response.rawPayload.toString()).toBe('%PDF-1.7\npreview');
    },
  );

  it('rejects malformed nomination IDs before generation', async () => {
    const token = new JwtService({ secret }).sign({ sub: 'admin', role: 'ADM' });
    const response = await adapter.getInstance().inject({
      method: 'GET',
      url: '/nominations/not-a-uuid/nomination-instructions.pdf',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(400);
    expect(generateOperational).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
  });
});
