import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ContactCreateInput, ContactUpdateInput, ContactListQuery } from '@portlog/schemas';
import { COMMUNICATION_SELECT, directoryError } from '../shared/communication.js';
const SELECT = {
  id: true,
  name: true,
  ...COMMUNICATION_SELECT,
  notes: true,
  ownerId: true,
  clientLinks: { select: { client: { select: { id: true, name: true, entityType: true } } } },
} as const;
function present<T extends { clientLinks: Array<{ client: unknown }> }>(row: T) {
  const { clientLinks, ...data } = row;
  return { ...data, clients: clientLinks.map((l) => l.client) };
}
@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);
  constructor(private readonly prisma: PrismaService) {}
  async list(query: ContactListQuery) {
    const { q, cursor, limit, clientId, entityType, ownerId } = query;
    const rows = await this.prisma.contact.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' as const } },
                { emails: { has: q.toLowerCase() } },
              ],
            }
          : {}),
        ...(clientId || entityType
          ? {
              clientLinks: {
                some: {
                  ...(clientId ? { clientId } : {}),
                  ...(entityType ? { client: { entityType } } : {}),
                },
              },
            }
          : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: SELECT,
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
    const row = await this.prisma.contact.findUnique({ where: { id }, select: SELECT });
    if (!row) throw new NotFoundException('Contact not found.');
    return present(row);
  }
  async create(input: ContactCreateInput) {
    const { phones, addresses, clientIds, ...data } = input;
    try {
      return present(
        await this.prisma.contact.create({
          data: {
            ...data,
            phones: { create: phones },
            addresses: { create: addresses },
            clientLinks: { create: clientIds.map((clientId) => ({ clientId })) },
          },
          select: SELECT,
        }),
      );
    } catch (error) {
      directoryError(error);
    }
  }
  async update(id: string, input: ContactUpdateInput) {
    await this.getById(id);
    const { phones, addresses, clientIds, ...data } = input;
    try {
      return present(
        await this.prisma.contact.update({
          where: { id },
          data: {
            ...data,
            ...(phones !== undefined ? { phones: { deleteMany: {}, create: phones } } : {}),
            ...(addresses !== undefined
              ? { addresses: { deleteMany: {}, create: addresses } }
              : {}),
            ...(clientIds !== undefined
              ? {
                  clientLinks: {
                    deleteMany: {},
                    create: clientIds.map((clientId) => ({ clientId })),
                  },
                }
              : {}),
          },
          select: SELECT,
        }),
      );
    } catch (error) {
      directoryError(error);
    }
  }
  async remove(id: string) {
    await this.getById(id);
    try {
      await this.prisma.contact.delete({ where: { id } });
    } catch (error) {
      directoryError(error);
    }
    this.logger.log({ event: 'contacts.delete', id });
  }
  async search(q: string) {
    const rows = await this.prisma.contact.findMany({
      take: 20,
      where: {
        OR: [{ name: { contains: q, mode: 'insensitive' } }, { emails: { has: q.toLowerCase() } }],
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true },
    });
    return rows.map((row) => ({ id: row.id, label: row.name }));
  }
}
