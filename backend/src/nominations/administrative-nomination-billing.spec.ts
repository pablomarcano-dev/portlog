import { APP_PIPE } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type {
  AdministrativeBillingCategory,
  AdministrativeBillingRecipient,
  AdministrativeBillingSelection,
} from '@portlog/schemas';
import { ZodValidationPipe } from 'nestjs-zod';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdministrativeNominationBillingController } from './administrative-nomination-billing.controller.js';
import { AdministrativeNominationBillingService } from './administrative-nomination-billing.service.js';

const nominationId = '805a17a2-6a82-4117-b3d8-483ea4549171';
const billingPath = `/nominations/${nominationId}/administrative-billing`;
const selection: AdministrativeBillingSelection = {
  clientId: 'clfoox01y0000u7fcf2dp22o9',
  addressPurpose: 'TAX',
  addressText: 'Fiscal address of a different client\nAttention: Accounts Payable  ',
};
const recipient = { ...selection, clientName: 'Independent invoicing company' };
type Row = AdministrativeBillingRecipient & { category: AdministrativeBillingCategory };

describe('administrative nomination billing HTTP contract', () => {
  const rows = new Map<AdministrativeBillingCategory, Row>();
  const tx = {
    $queryRaw: jest.fn(),
    client: { findUnique: jest.fn() },
    administrativeNominationBillingRecipient: {
      upsert: jest.fn(({ create }: { create: Row }) => {
        const { category, clientId, clientName, addressPurpose, addressText } = create;
        const saved = { clientId, clientName, addressPurpose, addressText };
        rows.set(category, { category, ...saved });
        return saved;
      }),
      deleteMany: jest.fn(({ where }: { where: { category: AdministrativeBillingCategory } }) =>
        rows.delete(where.category),
      ),
    },
  };
  const prisma = {
    nomination: {
      findUnique: jest.fn(() => ({ administrativeBillingRecipients: [...rows.values()] })),
    },
    $transaction: (work: (fixture: typeof tx) => unknown) => work(tx),
  };
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdministrativeNominationBillingController],
      providers: [
        AdministrativeNominationBillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
      ],
    }).compile();
    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    rows.clear();
    tx.$queryRaw.mockResolvedValue([{ status: 'NOMINATED' }]);
    tx.client.findUnique.mockResolvedValue({
      name: recipient.clientName,
      addresses: [{ text: selection.addressText }],
    });
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('returns empty categories for a nomination created before billing was available', async () => {
    const result = await app.inject({ method: 'GET', url: billingPath });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toEqual({
      PORT_COSTS: null,
      OWNER_EXPENSES: null,
      TECHNICAL_MANAGEMENT: null,
    });
  });

  it('snapshots the selected company and address and clears only the selected category', async () => {
    const portCostsPath = `${billingPath}/PORT_COSTS`;
    const saved = await app.inject({ method: 'PUT', url: portCostsPath, payload: { selection } });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ recipient });
    expect(tx.client.findUnique).toHaveBeenCalledWith({
      where: { id: selection.clientId },
      select: {
        name: true,
        addresses: {
          where: { purpose: selection.addressPurpose, text: selection.addressText },
          select: { text: true },
          take: 1,
        },
      },
    });

    const ownerSelection = {
      ...selection,
      addressPurpose: 'BILLING',
      addressText: 'Owner address',
    };
    tx.client.findUnique.mockResolvedValue({
      name: 'Owner expense payee',
      addresses: [{ text: ownerSelection.addressText }],
    });
    await app.inject({
      method: 'PUT',
      url: `${billingPath}/OWNER_EXPENSES`,
      payload: { selection: ownerSelection },
    });
    const beforeClear = await app.inject({ method: 'GET', url: billingPath });
    expect(beforeClear.json().PORT_COSTS).toEqual(recipient);

    const cleared = await app.inject({
      method: 'PUT',
      url: portCostsPath,
      payload: { selection: null },
    });
    expect(cleared.statusCode).toBe(200);
    expect(cleared.json()).toEqual({ recipient: null });
    const afterClear = await app.inject({ method: 'GET', url: billingPath });
    expect(afterClear.json()).toEqual({
      PORT_COSTS: null,
      OWNER_EXPENSES: { ...ownerSelection, clientName: 'Owner expense payee' },
      TECHNICAL_MANAGEMENT: null,
    });
  });

  it('rejects non-fiscal address purposes and unknown categories before calling Prisma', async () => {
    const invalidPurpose = await app.inject({
      method: 'PUT',
      url: `${billingPath}/PORT_COSTS`,
      payload: { selection: { ...selection, addressPurpose: 'PHYSICAL' } },
    });
    const invalidCategory = await app.inject({
      method: 'PUT',
      url: `${billingPath}/OTHER`,
      payload: { selection },
    });
    expect(invalidPurpose.statusCode).toBe(400);
    expect(invalidCategory.statusCode).toBe(400);
    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a changed or removed address and prevents writing on a canceled nomination', async () => {
    const request = {
      method: 'PUT',
      url: `${billingPath}/TECHNICAL_MANAGEMENT`,
      payload: { selection },
    } as const;
    tx.client.findUnique.mockResolvedValue({ name: recipient.clientName, addresses: [] });
    const stale = await app.inject(request);
    expect(stale.statusCode).toBe(409);
    expect(stale.json().message).toMatch(/address changed/);

    tx.$queryRaw.mockResolvedValue([{ status: 'CANCELLED' }]);
    const canceled = await app.inject(request);
    expect(canceled.statusCode).toBe(409);
    expect(canceled.json().message).toMatch(/cancelled/);
    expect(tx.administrativeNominationBillingRecipient.upsert).not.toHaveBeenCalled();
  });
});
