import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { OperatorCreateInput, OperatorUpdateInput, OperatorListQuery } from '@portlog/schemas';

@Injectable()
export class OperatorsService {
  private readonly logger = new Logger(OperatorsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: OperatorListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.operator.findMany({
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
        standardRequirements: true,
        sendCopy: true,
        location: true,
        comments: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((o) => ({ ...o, label: o.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const operator = await this.prisma.operator.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        businessPhone: true,
        businessFax: true,
        address: true,
        standardRequirements: true,
        sendCopy: true,
        location: true,
        comments: true,
      },
    });

    if (!operator) {
      throw new NotFoundException(`Operator ${id} not found.`);
    }

    return operator;
  }

  async create(input: OperatorCreateInput) {
    // itemsProforma is a Json placeholder for M6/PDA — excluded here to avoid
    // Prisma InputJsonValue type mismatch with Record<string, unknown>.
    const { itemsProforma: _ip, ...data } = input;
    void _ip;
    try {
      return await this.prisma.operator.create({
        data,
        select: {
          id: true,
          name: true,
          email: true,
          businessPhone: true,
          businessFax: true,
          address: true,
          standardRequirements: true,
          sendCopy: true,
          location: true,
          comments: true,
        },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An operator named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: OperatorUpdateInput) {
    await this.assertExists(id);
    // itemsProforma is a Json placeholder for M6/PDA — excluded here to avoid
    // Prisma InputJsonValue type mismatch with Record<string, unknown>.
    const { itemsProforma: _ip, ...data } = input;
    void _ip;
    try {
      return await this.prisma.operator.update({
        where: { id },
        data,
        select: {
          id: true,
          name: true,
          email: true,
          businessPhone: true,
          businessFax: true,
          address: true,
          standardRequirements: true,
          sendCopy: true,
          location: true,
          comments: true,
        },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An operator named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.operator.delete({ where: { id } });
    this.logger.log({ event: 'operators.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.operator.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((o) => ({ id: o.id, label: o.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.operator.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Operator ${id} not found.`);
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
