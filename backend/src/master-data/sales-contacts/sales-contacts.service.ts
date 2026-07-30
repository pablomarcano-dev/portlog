import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  SalesContactCreateInput,
  SalesContactUpdateInput,
  SalesContactListQuery,
} from '@portlog/schemas';

const SALES_CONTACT_SELECT = {
  id: true,
  name: true,
  phone: true,
  mobile: true,
  documentNumber: true,
  vehicle: true,
  comments: true,
} as const;

@Injectable()
export class SalesContactsService {
  private readonly logger = new Logger(SalesContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor-based list with optional search on `name`.
   * Returns `limit + 1` rows so the caller can detect `hasMore`.
   */
  async list(query: SalesContactListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.salesContact.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined,
      orderBy: { name: 'asc' },
      select: SALES_CONTACT_SELECT,
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
    const contact = await this.prisma.salesContact.findUnique({
      where: { id },
      select: SALES_CONTACT_SELECT,
    });

    if (!contact) {
      throw new NotFoundException(`Sales contact ${id} not found.`);
    }

    return contact;
  }

  async create(input: SalesContactCreateInput) {
    return this.prisma.salesContact.create({
      data: input,
      select: SALES_CONTACT_SELECT,
    });
  }

  async update(id: string, input: SalesContactUpdateInput) {
    await this.assertExists(id);
    return this.prisma.salesContact.update({
      where: { id },
      data: input,
      select: SALES_CONTACT_SELECT,
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    try {
      await this.prisma.salesContact.delete({ where: { id } });
    } catch (err: unknown) {
      // sales.driverId / sales.userId are ON DELETE RESTRICT — a contact still
      // named on a voucher must stay. Surface as a conflict, not a 500.
      if (this.isPrismaError(err, 'P2003')) {
        throw new ConflictException('Sales contact is named on one or more sales.');
      }
      throw err;
    }
    this.logger.log({ event: 'sales-contact.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.salesContact.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.salesContact.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Sales contact ${id} not found.`);
    }
  }

  private isPrismaError(err: unknown, code: string): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === code
    );
  }
}
