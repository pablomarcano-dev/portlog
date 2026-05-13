import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ContactCreateInput, ContactUpdateInput, ContactListQuery } from '@portlog/schemas';

const CONTACT_SELECT = {
  id: true,
  name: true,
  email: true,
  homePhone: true,
  mobile: true,
  businessPhone: true,
  businessFax: true,
  address: true,
  shipperId: true,
  operatorId: true,
  ownerId: true,
  charterId: true,
  comments: true,
} as const;

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ContactListQuery) {
    const { q, limit, cursor, shipperId, operatorId, ownerId, charterId } = query;

    const items = await this.prisma.contact.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(shipperId ? { shipperId } : {}),
        ...(operatorId ? { operatorId } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(charterId ? { charterId } : {}),
      },
      orderBy: { name: 'asc' },
      select: CONTACT_SELECT,
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
    const contact = await this.prisma.contact.findUnique({
      where: { id },
      select: CONTACT_SELECT,
    });

    if (!contact) {
      throw new NotFoundException(`Contact ${id} not found.`);
    }

    return contact;
  }

  async create(input: ContactCreateInput) {
    this.assertSingleOwner(input);
    try {
      return await this.prisma.contact.create({
        data: input,
        select: CONTACT_SELECT,
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
    }
  }

  async update(id: string, input: ContactUpdateInput) {
    await this.assertExists(id);
    this.assertSingleOwner(input);
    try {
      return await this.prisma.contact.update({
        where: { id },
        data: input,
        select: CONTACT_SELECT,
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.contact.delete({ where: { id } });
    this.logger.log({ event: 'contacts.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.contact.findMany({
      take: 20,
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name }));
  }

  // ---------------------------------------------------------------------------
  // Guards
  // ---------------------------------------------------------------------------

  private assertSingleOwner(input: ContactCreateInput | ContactUpdateInput) {
    const fks = [input.shipperId, input.operatorId, input.ownerId, input.charterId];
    if (fks.filter(Boolean).length > 1) {
      throw new BadRequestException('contact_multiple_owners');
    }
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.contact.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Contact ${id} not found.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------

  /**
   * Catches Prisma P2002 (unique violation) and P2003 (FK constraint) errors,
   * as well as DB-level CHECK constraint violations (mapped to P2002/raw errors),
   * and surfaces them as 400 BadRequestException with a human-readable message.
   */
  private handlePrismaError(err: unknown): never {
    if (typeof err === 'object' && err !== null && 'code' in err) {
      const code = (err as { code: string }).code;
      if (code === 'P2002') {
        throw new BadRequestException('A contact with these unique fields already exists.');
      }
    }
    // CHECK constraint violations surface as PrismaClientKnownRequestError with
    // code P2010 (raw query error) or as an error message containing the constraint name.
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const msg = String((err as { message: string }).message);
      if (msg.includes('contacts_single_owner_chk')) {
        throw new BadRequestException('contact_multiple_owners');
      }
    }
    throw err as Error;
  }
}
