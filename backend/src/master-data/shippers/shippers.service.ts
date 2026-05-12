import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ShipperCreateInput, ShipperUpdateInput, ShipperListQuery } from '@portlog/schemas';

@Injectable()
export class ShippersService {
  private readonly logger = new Logger(ShippersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ShipperListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.shipper.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q
        ? {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          }
        : undefined,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        businessPhone: true,
        businessFax: true,
        address: true,
        comments: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((s) => ({ ...s, label: s.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const shipper = await this.prisma.shipper.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        businessPhone: true,
        businessFax: true,
        address: true,
        comments: true,
      },
    });

    if (!shipper) {
      throw new NotFoundException(`Shipper ${id} not found.`);
    }

    return shipper;
  }

  async create(input: ShipperCreateInput) {
    try {
      return await this.prisma.shipper.create({
        data: input,
        select: {
          id: true,
          name: true,
          email: true,
          businessPhone: true,
          businessFax: true,
          address: true,
          comments: true,
        },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A shipper named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: ShipperUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.shipper.update({
        where: { id },
        data: input,
        select: {
          id: true,
          name: true,
          email: true,
          businessPhone: true,
          businessFax: true,
          address: true,
          comments: true,
        },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A shipper named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.shipper.delete({ where: { id } });
    this.logger.log({ event: 'shippers.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.shipper.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((s) => ({ id: s.id, label: s.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.shipper.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Shipper ${id} not found.`);
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
