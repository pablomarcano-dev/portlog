import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import PizZip from 'pizzip';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { JwtStrategy } from '../auth/jwt.strategy.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdministrativeNominationInstructionsDocxService } from './administrative-nomination-instructions-docx.service.js';
import { AdministrativeNominationInstructionsController } from './administrative-nomination-instructions.controller.js';
import { AdministrativeNominationInstructionsService } from './administrative-nomination-instructions.service.js';

describe('AdministrativeNominationInstructionsService', () => {
  const fixture = {
    correlative: 3092,
    dateNominated: new Date('2026-11-19T14:00:00Z'),
    kind: 'SN',
    etaDate: new Date('2026-11-10T12:00:00Z'),
    grt: null,
    sdwt: new Prisma.Decimal(107169),
    loa: null,
    branch: { code: 'MBO' },
    pedr: { etaRecord: { etaNotify: new Date('2026-11-13T03:30:00Z') } },
    opPort: { name: 'PUERTO MIRANDA TERMINAL', municipality: 'MIRANDA' },
    client: {
      administrativePortCostInstructions: 'Standing port rules\nUse only approved costs',
      administrativeOwnerExpensesInstructions: 'Owner rules',
      administrativeTechnicalManagementInstructions: 'Check the SOF',
    },
    charterer: { administrativePortCostInstructions: 'Different instructions' },
    shipParticular: {
      name: 'FOREVER',
      imoNumber: '9136058',
      grt: new Prisma.Decimal(57949),
      dwt: new Prisma.Decimal(108000),
      loa: new Prisma.Decimal('246.80'),
      flag: { name: 'GAMBIA' },
    },
    administrativeBillingRecipients: [
      { category: 'PORT_COSTS', clientName: 'Port payer', addressText: 'Port fiscal address' },
      {
        category: 'TECHNICAL_MANAGEMENT',
        clientName: 'Tech payer',
        addressText: 'Address\nFloor 2',
      },
    ],
  };

  const findUnique = jest.fn();
  const buffer = Buffer.from('generated document');
  const render = jest.fn(() => buffer);
  const service = new AdministrativeNominationInstructionsService(
    { nomination: { findUnique } } as unknown as PrismaService,
    { render } as unknown as AdministrativeNominationInstructionsDocxService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('combines the saved voyage, vessel, port, selected client and independent billing snapshots', async () => {
    findUnique.mockResolvedValue(fixture);

    await expect(service.generate('nomination-id')).resolves.toEqual({
      filename: 'SN-26-3092-administrative-nomination-instructions.docx',
      buffer,
    });
    expect(render).toHaveBeenCalledWith({
      snOt: 'SN3092/26/MBO',
      vessel: 'FOREVER',
      arrivalDay: 'NOV 12TH, 2026',
      operationPort: 'PUERTO MIRANDA TERMINAL',
      portCostInstructions: fixture.client.administrativePortCostInstructions,
      ownerExpensesInstructions: 'Owner rules',
      technicalManagementInstructions: 'Check the SOF',
      imo: '9136058',
      grt: '57949',
      flag: 'GAMBIA',
      dwt: '107169',
      loa: '246.80',
      municipality: 'MIRANDA',
      portCostsBilling: 'Port payer\nPort fiscal address',
      ownerExpensesBilling: '',
      technicalManagementBilling: 'Tech payer\nAddress\nFloor 2',
    });
  });

  it('supports legacy records with only a charterer and the original nomination ETA', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      kind: 'OT',
      branch: null,
      pedr: null,
      opPort: null,
      client: null,
      sdwt: null,
      administrativeBillingRecipients: [],
    });

    await service.generate('nomination-id');

    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        snOt: 'OT3092/26',
        arrivalDay: 'NOV 10TH, 2026',
        operationPort: '',
        municipality: '',
        dwt: '108000',
        portCostInstructions: 'Different instructions',
        ownerExpensesInstructions: '',
        technicalManagementInstructions: '',
        portCostsBilling: '',
        ownerExpensesBilling: '',
        technicalManagementBilling: '',
      }),
    );
  });

  it('leaves optional fields blank and rejects an unknown nomination', async () => {
    findUnique.mockResolvedValueOnce({
      ...fixture,
      etaDate: null,
      pedr: null,
      client: null,
      charterer: null,
    });
    findUnique.mockResolvedValueOnce(null);

    await service.generate('nomination-id');
    await expect(service.generate('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        arrivalDay: '',
        portCostInstructions: '',
      }),
    );
  });

  it('serves an authenticated Word download with populated sections and private cache headers', async () => {
    findUnique.mockResolvedValue(fixture);
    const secret = 'administrative-instructions-local-test';
    const module = await Test.createTestingModule({
      controllers: [AdministrativeNominationInstructionsController],
      providers: [
        AdministrativeNominationInstructionsService,
        AdministrativeNominationInstructionsDocxService,
        JwtStrategy,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        { provide: PrismaService, useValue: { nomination: { findUnique } } },
      ],
    }).compile();
    const fastify = new FastifyAdapter();
    const app = module.createNestApplication<NestFastifyApplication>(fastify);
    const url =
      '/nominations/6039ed24-664e-48ed-8ca9-a0acc7419d83/administrative-nomination-instructions.docx';
    const token = new JwtService({ secret }).sign({ sub: 'test-operator', role: 'OPS' });

    try {
      await app.init();
      const server = fastify.getInstance();
      await server.ready();
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);

      const response = await server.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.headers['content-disposition']).toBe(
        'attachment; filename="SN-26-3092-administrative-nomination-instructions.docx"',
      );
      expect(response.headers['content-type']).toContain('wordprocessingml.document');
      const zip = new PizZip(response.rawPayload);
      const xml = zip.file('word/document.xml')?.asText() ?? '';
      expect(xml).toContain('SN3092/26/MBO');
      expect(xml).toContain('NOV 12TH, 2026');
      expect(xml).toContain('Check the SOF');
      expect(xml).toContain('Port fiscal address');
      expect(xml).toContain('MIRANDA');
    } finally {
      await app.close();
    }
  });
});
