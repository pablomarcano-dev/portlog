import { UsersService } from '../users/users.service.js';
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
      name: 'Selected instruction client',
      administrativePortCostInstructions: 'Standing port rules\nUse only approved costs',
      administrativeOwnerExpensesInstructions: 'Owner rules',
      administrativeTechnicalManagementInstructions: 'Check the SOF',
    },
    charterer: {
      name: 'Fallback charterer',
      administrativePortCostInstructions: 'Different instructions',
    },
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

  it('prints a new issued snapshot unchanged after later branch/date edits', async () => {
    findUnique.mockResolvedValue({ ...fixture, businessReference: 'SN3140/26/PBO', correlative: 21, dateNominated: new Date('2027-01-01T00:00:00Z'), branch: { code: 'PLC' } });
    await expect(service.generate('nomination-id')).resolves.toEqual({ filename: 'SN3140-26-PBO-administrative-nomination-instructions.docx', buffer });
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ snOt: 'SN3140/26/PBO' }));
  });

  it('prints the saved agency reference when it differs from the application sequence', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      correlative: 21,
      administrativeSnOt: 'SN3092/26/MBO',
    });

    await expect(service.generate('nomination-id')).resolves.toEqual({
      filename: 'SN3092-26-MBO-administrative-nomination-instructions.docx',
      buffer,
    });
    expect(render).toHaveBeenCalledWith(expect.objectContaining({ snOt: 'SN3092/26/MBO' }));
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

  it('reports populated saved fields and all three independent fiscal snapshots', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      administrativeBillingRecipients: [
        ...fixture.administrativeBillingRecipients,
        {
          category: 'OWNER_EXPENSES',
          clientName: 'Owner payer',
          addressText: 'Owner fiscal address',
        },
      ],
    });
    const report = await service.diagnostics('nomination-id');
    expect(report.instructionSource).toBe('INSTRUCTION_CLIENT');
    expect(report.instructionClientName).toBe('Selected instruction client');
    expect(report.checks).toHaveLength(7);
    expect(report.checks.every((check) => check.status === 'POPULATED')).toBe(true);
    expect(render).not.toHaveBeenCalled();
  });

  it('does not replace a selected client’s blank instructions with charterer rules', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      client: {
        name: 'Selected blank client',
        administrativePortCostInstructions: '  ',
        administrativeOwnerExpensesInstructions: null,
        administrativeTechnicalManagementInstructions: null,
      },
    });
    const report = await service.diagnostics('nomination-id');
    expect(report.instructionSource).toBe('INSTRUCTION_CLIENT');
    expect(report.instructionClientName).toBe('Selected blank client');
    expect(report.checks.slice(0, 3).map((check) => check.status)).toEqual([
      'MISSING',
      'MISSING',
      'MISSING',
    ]);
    expect(report.checks.find((check) => check.field === 'OWNER_EXPENSES_BILLING')?.status).toBe(
      'MISSING',
    );
  });

  it('identifies the charterer fallback only when no instruction client is selected', async () => {
    findUnique.mockResolvedValue({ ...fixture, client: null });
    const report = await service.diagnostics('nomination-id');
    expect(report.instructionSource).toBe('CHARTERER_FALLBACK');
    expect(report.instructionClientName).toBe('Fallback charterer');
    expect(report.checks[0].status).toBe('POPULATED');
    expect(report.checks[1].status).toBe('MISSING');
  });

  it('identifies missing sources and incomplete fiscal snapshots without copying another category', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      client: null,
      charterer: null,
      opPort: null,
      administrativeBillingRecipients: [
        { category: 'PORT_COSTS', clientName: 'Port payer', addressText: '  ' },
      ],
    });
    const report = await service.diagnostics('nomination-id');
    expect(report.instructionSource).toBe('NONE');
    expect(report.instructionClientName).toBeNull();
    expect(report.checks.find((check) => check.field === 'PORT_COSTS_BILLING')?.status).toBe(
      'INCOMPLETE',
    );
    expect(report.checks.filter((check) => check.status === 'MISSING')).toHaveLength(6);
    findUnique.mockResolvedValue(null);
    await expect(service.diagnostics('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('renders all configured fields into the actual Word document', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      administrativeBillingRecipients: [
        ...fixture.administrativeBillingRecipients,
        {
          category: 'OWNER_EXPENSES',
          clientName: 'Owner payer',
          addressText: 'Owner fiscal address',
        },
      ],
    });
    const actual = new AdministrativeNominationInstructionsService(
      { nomination: { findUnique } } as unknown as PrismaService,
      new AdministrativeNominationInstructionsDocxService(),
    );
    const file = await actual.generate('nomination-id');
    const xml = new PizZip(file.buffer).file('word/document.xml')?.asText() ?? '';
    for (const value of [
      'Standing port rules',
      'Owner rules',
      'Check the SOF',
      'MIRANDA',
      'Port fiscal address',
      'Owner fiscal address',
      'Tech payer',
      'Floor 2',
    ]) {
      expect(xml).toContain(value);
    }
    expect(xml).not.toContain('Different instructions');
  });

  it('reproduces the reported blank sections when their saved sources are absent', async () => {
    findUnique.mockResolvedValue({
      ...fixture,
      client: {
        name: 'Selected blank client',
        administrativePortCostInstructions: null,
        administrativeOwnerExpensesInstructions: null,
        administrativeTechnicalManagementInstructions: null,
      },
      opPort: { name: 'Example Terminal', municipality: null },
      administrativeBillingRecipients: [],
    });
    const actual = new AdministrativeNominationInstructionsService(
      { nomination: { findUnique } } as unknown as PrismaService,
      new AdministrativeNominationInstructionsDocxService(),
    );
    const report = await actual.diagnostics('nomination-id');
    expect(report.checks.every((check) => check.status === 'MISSING')).toBe(true);
    const file = await actual.generate('nomination-id');
    const xml = new PizZip(file.buffer).file('word/document.xml')?.asText() ?? '';
    expect(xml).toContain('FOREVER');
    expect(xml).toContain('107169');
    expect(xml).toContain('Example Terminal');
    for (const absent of [
      'Different instructions',
      'Standing port rules',
      'Owner rules',
      'Check the SOF',
      'Port fiscal address',
      'MIRANDA',
    ])
      expect(xml).not.toContain(absent);
    expect(xml).not.toContain('{portCostInstructions}');
  });

  it('restricts read-only source diagnostics to authenticated ADM users', async () => {
    findUnique.mockResolvedValue(fixture);
    const secret = 'administrative-diagnostics-local-test';
    const module = await Test.createTestingModule({
      controllers: [AdministrativeNominationInstructionsController],
      providers: [
        AdministrativeNominationInstructionsService,
        AdministrativeNominationInstructionsDocxService,
        JwtStrategy,
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(async (id: string) => ({
              id,
              email: `${id}@example.test`,
              role: ['adm', 'admin'].includes(id) ? 'ADM' : 'OPS',
              isActive: true,
              permissions: [],
              branchId: 'plc',
              branchAssignments: [],
            })),
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        {
          provide: PrismaService,
          useValue: {
            nomination: { findUnique },
            branch: { findUnique: jest.fn(async () => ({ id: 'plc' })) },
          },
        },
      ],
    }).compile();
    const fastify = new FastifyAdapter();
    const app = module.createNestApplication<NestFastifyApplication>(fastify);
    const url =
      '/nominations/6039ed24-664e-48ed-8ca9-a0acc7419d83/administrative-nomination-instructions/diagnostics';
    const jwt = new JwtService({ secret });
    try {
      await app.init();
      const server = fastify.getInstance();
      await server.ready();
      expect((await server.inject({ method: 'GET', url })).statusCode).toBe(401);
      expect(
        (
          await server.inject({
            method: 'GET',
            url,
            headers: { authorization: `Bearer ${jwt.sign({ sub: 'ops', role: 'OPS' })}` },
          })
        ).statusCode,
      ).toBe(403);
      expect(findUnique).not.toHaveBeenCalled();
      const response = await server.inject({
        method: 'GET',
        url,
        headers: { authorization: `Bearer ${jwt.sign({ sub: 'adm', role: 'ADM' })}` },
      });
      expect(response.statusCode).toBe(200);
      expect(response.json().checks).toHaveLength(7);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(response.body).not.toContain('Standing port rules');
      expect(render).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
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
        {
          provide: UsersService,
          useValue: {
            findById: jest.fn(async (id: string) => ({
              id,
              email: `${id}@example.test`,
              role: ['adm', 'admin'].includes(id) ? 'ADM' : 'OPS',
              isActive: true,
              permissions: [],
              branchId: 'plc',
              branchAssignments: [],
            })),
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: ConfigService, useValue: { get: () => secret } },
        {
          provide: PrismaService,
          useValue: {
            nomination: { findUnique },
            branch: { findUnique: jest.fn(async () => ({ id: 'plc' })) },
          },
        },
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
