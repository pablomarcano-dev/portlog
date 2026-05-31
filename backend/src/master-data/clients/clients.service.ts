import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ClientCreateInput, ClientUpdateInput, ClientListQuery } from '@portlog/schemas';

const CLIENT_SELECT = {
  id: true,
  name: true,
  phone: true,
  phone2: true,
  physicalAddress: true,
  billingAddress: true,
  postalAddress: true,
  taxAddress: true,
  otherAddress: true,
  fax: true,
  mobile: true,
  email: true,
  emailGroup: true,
  tariff: true,
  instructions: true,
} as const;

@Injectable()
export class ClientsService {
  private readonly logger = new Logger(ClientsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ClientListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.client.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      select: CLIENT_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((c) => ({ ...c, label: c.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: CLIENT_SELECT,
    });

    if (!client) {
      throw new NotFoundException(`Client ${id} not found.`);
    }

    return client;
  }

  async create(input: ClientCreateInput) {
    try {
      return await this.prisma.client.create({
        data: input,
        select: CLIENT_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A client named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: ClientUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.client.update({
        where: { id },
        data: input,
        select: CLIENT_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A client named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.client.delete({ where: { id } });
    this.logger.log({ event: 'clients.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.client.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Client ${id} not found.`);
    }
  }

  private isPrismaUniqueViolation(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    );
  }
}
