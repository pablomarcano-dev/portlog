import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ShipParticularCreateInput,
  ShipParticularUpdateInput,
  ShipParticularListQuery,
} from '@portlog/schemas';

const SELECT = {
  id: true,
  callSign: true,
  name: true,
  abbreviation: true,
  loa: true,
  dwt: true,
  grt: true,
  nrt: true,
  email: true,
  imoNumber: true,
  phone: true,
  phone2: true,
  fax: true,
  flagId: true,
  ownerId: true,
  operatorId: true,
  comments: true,
} as const;

@Injectable()
export class ShipParticularsService {
  private readonly logger = new Logger(ShipParticularsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ShipParticularListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.shipParticular.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { callSign: { contains: q, mode: 'insensitive' } },
              { imoNumber: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      select: SELECT,
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

  async findByImo(imo: string) {
    const ship = await this.prisma.shipParticular.findUnique({
      where: { imoNumber: imo },
      select: SELECT,
    });
    if (!ship) throw new NotFoundException(`No ship particular with IMO ${imo}.`);
    return ship;
  }

  async getById(id: string) {
    const ship = await this.prisma.shipParticular.findUnique({
      where: { id },
      select: SELECT,
    });

    if (!ship) {
      throw new NotFoundException(`ShipParticular ${id} not found.`);
    }

    return ship;
  }

  async create(input: ShipParticularCreateInput) {
    try {
      return await this.prisma.shipParticular.create({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: input as any,
        select: SELECT,
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
      throw err;
    }
  }

  async update(id: string, input: ShipParticularUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.shipParticular.update({
        where: { id },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: input as any,
        select: SELECT,
      });
    } catch (err: unknown) {
      this.handlePrismaError(err);
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.shipParticular.delete({ where: { id } });
    this.logger.log({ event: 'ship-particulars.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.shipParticular.findMany({
      take: 20,
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { callSign: { contains: q, mode: 'insensitive' } },
          { imoNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((s) => ({ id: s.id, label: s.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.shipParticular.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`ShipParticular ${id} not found.`);
    }
  }

  private handlePrismaError(err: unknown): void {
    if (!(err instanceof Prisma.PrismaClientKnownRequestError)) return;

    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[])?.join(', ') ?? 'field';
      throw new ConflictException(`Duplicate value on: ${target}`);
    }

    if (err.code === 'P2003') {
      throw new BadRequestException(`Invalid foreign key reference`);
    }
  }
}
