import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ClientCreateInput, ClientUpdateInput, ClientListQuery } from '@portlog/schemas';
import { COMMUNICATION_SELECT, directoryError } from '../shared/communication.js';

export const CLIENT_SELECT = {
  id: true,
  name: true,
  entityType: true,
  ...COMMUNICATION_SELECT,
  instructions: true,
  notes: true,
  locationType: true,
  tariffItems: {
    orderBy: { sortOrder: 'asc' },
    select: { item: true, amountText: true, information: true, sortOrder: true },
  },
  emailGroups: {
    orderBy: { slot: 'asc' },
    select: {
      slot: true,
      emailGroupId: true,
      emailGroup: {
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { order: 'asc' },
            select: { id: true, email: true, displayName: true, order: true },
          },
        },
      },
    },
  },
  contactLinks: {
    orderBy: { contact: { name: 'asc' } },
    select: { contact: { select: { id: true, name: true, ...COMMUNICATION_SELECT } } },
  },
} as const;
function present<T extends { contactLinks: Array<{ contact: unknown }> }>(row: T) {
  const { contactLinks, ...data } = row;
  return { ...data, contacts: contactLinks.map((l) => l.contact) };
}
@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);
  constructor(private readonly prisma: PrismaService) {}
  async list(query: ClientListQuery) {
    const { q, cursor, limit, entityType } = query;
    const rows = await this.prisma.client.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(entityType ? { entityType } : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: CLIENT_SELECT,
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({ ...present(row), label: row.name })),
      hasMore,
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }
  async getById(id: string) {
    const row = await this.prisma.client.findUnique({ where: { id }, select: CLIENT_SELECT });
    if (!row) throw new NotFoundException('Client not found.');
    return present(row);
  }
  async create(input: ClientCreateInput) {
    const { phones, addresses, tariffItems, emailGroups, contactIds, ...data } = input;
    try {
      return present(
        await this.prisma.client.create({
          data: {
            ...data,
            phones: { create: phones },
            addresses: { create: addresses },
            tariffItems: { create: tariffItems },
            emailGroups: { create: emailGroups },
            contactLinks: { create: contactIds.map((contactId) => ({ contactId })) },
          },
          select: CLIENT_SELECT,
        }),
      );
    } catch (error) {
      directoryError(error);
    }
  }
  async update(id: string, input: ClientUpdateInput) {
    await this.getById(id);
    const { phones, addresses, tariffItems, emailGroups, contactIds, ...data } = input;
    try {
      // A nested write is one transaction. Collections use replacement semantics;
      // input never accepts database child IDs, so rows cannot move between parents.
      return present(
        await this.prisma.client.update({
          where: { id },
          data: {
            ...data,
            ...(phones !== undefined ? { phones: { deleteMany: {}, create: phones } } : {}),
            ...(addresses !== undefined
              ? { addresses: { deleteMany: {}, create: addresses } }
              : {}),
            ...(tariffItems !== undefined
              ? { tariffItems: { deleteMany: {}, create: tariffItems } }
              : {}),
            ...(emailGroups !== undefined
              ? { emailGroups: { deleteMany: {}, create: emailGroups } }
              : {}),
            ...(contactIds !== undefined
              ? {
                  contactLinks: {
                    deleteMany: {},
                    create: contactIds.map((contactId) => ({ contactId })),
                  },
                }
              : {}),
          },
          select: CLIENT_SELECT,
        }),
      );
    } catch (error) {
      directoryError(error);
    }
  }
  async remove(id: string) {
    await this.getById(id);
    try {
      await this.prisma.client.delete({ where: { id } });
    } catch (error) {
      directoryError(error);
    }
    this.logger.log({ event: 'clients.delete', id });
  }
  async search(q: string) {
    const rows = await this.prisma.client.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, entityType: true },
    });
    return rows.map((row) => ({ ...row, label: row.name }));
  }
}
