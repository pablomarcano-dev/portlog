import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ContactCreateSchema } from '@portlog/schemas';
const row = {
  id: 'contact-1',
  name: 'Person',
  emails: [],
  phones: [],
  addresses: [],
  ownerId: null,
  notes: null,
  clientLinks: [],
};
const prisma = {
  contact: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};
describe('ContactsService', () => {
  let service: ContactsService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = module.get(ContactsService);
  });
  it('presents linked Clients through one association', async () => {
    prisma.contact.findUnique.mockResolvedValue({
      ...row,
      clientLinks: [{ client: { id: 'company', name: 'Company', entityType: 'SHIPPER' } }],
    });
    expect(await service.getById(row.id)).toMatchObject({ clients: [{ id: 'company' }] });
  });
  it('creates links to multiple Clients', async () => {
    prisma.contact.create.mockResolvedValue(row);
    await service.create(
      ContactCreateSchema.parse({
        name: 'Person',
        clientIds: ['cms2268fg00cspz6hc0dz4yac', 'cms2268fg00cspz6hc0dz4yad'],
      }),
    );
    expect(prisma.contact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientLinks: {
            create: [
              { clientId: 'cms2268fg00cspz6hc0dz4yac' },
              { clientId: 'cms2268fg00cspz6hc0dz4yad' },
            ],
          },
        }),
      }),
    );
  });
  it('does not clear omitted collections on patch', async () => {
    prisma.contact.findUnique.mockResolvedValue(row);
    prisma.contact.update.mockResolvedValue(row);
    await service.update(row.id, { notes: 'Updated' });
    expect(prisma.contact.update.mock.calls[0][0].data).toEqual({ notes: 'Updated' });
  });
  it('clears associations without deleting people', async () => {
    prisma.contact.findUnique.mockResolvedValue(row);
    prisma.contact.update.mockResolvedValue(row);
    await service.update(row.id, { clientIds: [] });
    expect(prisma.contact.update.mock.calls[0][0].data.clientLinks).toEqual({
      deleteMany: {},
      create: [],
    });
    expect(prisma.contact.delete).not.toHaveBeenCalled();
  });
  it('returns not found for an absent person', async () => {
    prisma.contact.findUnique.mockResolvedValue(null);
    await expect(service.getById('absent')).rejects.toThrow(NotFoundException);
  });
});
