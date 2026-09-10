import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ClientCreateSchema } from '@portlog/schemas';
const row = {
  id: 'client-1',
  name: 'Company',
  entityType: 'SHIPPER',
  emails: [],
  phones: [],
  addresses: [],
  emailGroups: [],
  tariffItems: [],
  contactLinks: [],
};
const prisma = {
  client: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
describe('ClientsService', () => {
  let service: ClientsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ClientsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ClientsService);
  });
  it('creates typed communication records and group slots in one nested write', async () => {
    prisma.client.create.mockResolvedValue(row);
    await service.create(
      ClientCreateSchema.parse({
        name: 'Company',
        entityType: 'SHIPPER',
        phones: [{ kind: 'MOBILE', number: '123' }],
        emailGroups: [{ slot: 'CC_MESSAGE', emailGroupId: 'cms2268fg00cspz6hc0dz4yac' }],
      }),
    );
    expect(prisma.client.create.mock.calls[0][0].data).toMatchObject({
      entityType: 'SHIPPER',
      phones: { create: [{ kind: 'MOBILE', number: '123' }] },
      emailGroups: { create: [{ slot: 'CC_MESSAGE' }] },
    });
  });
  it('type-only edits leave collections and instructions untouched', async () => {
    prisma.client.findUnique.mockResolvedValue(row);
    prisma.client.update.mockResolvedValue(row);
    await service.update(row.id, { entityType: 'OPERATOR' });
    expect(prisma.client.update.mock.calls[0][0].data).toEqual({ entityType: 'OPERATOR' });
  });
  it('explicit empty collections clear only those children', async () => {
    prisma.client.findUnique.mockResolvedValue(row);
    prisma.client.update.mockResolvedValue(row);
    await service.update(row.id, { phones: [], emailGroups: [] });
    expect(prisma.client.update.mock.calls[0][0].data).toEqual({
      phones: { deleteMany: {}, create: [] },
      emailGroups: { deleteMany: {}, create: [] },
    });
  });
  it('reports bill-to deletion restrictions cleanly', async () => {
    prisma.client.findUnique.mockResolvedValue(row);
    prisma.client.delete.mockRejectedValue({ code: 'P2003' });
    await expect(service.remove(row.id)).rejects.toThrow(BadRequestException);
  });
});
