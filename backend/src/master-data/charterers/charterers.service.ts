import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  ChartererCreateInput,
  ChartererUpdateInput,
  ChartererListQuery,
} from '@portlog/schemas';

@Injectable()
export class CharterersService {
  private readonly logger = new Logger(CharterersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ChartererListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.charterer.findMany({
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
      select: { id: true, name: true, address: true, contactInfo: true, comments: true },
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
    const charterer = await this.prisma.charterer.findUnique({
      where: { id },
      select: { id: true, name: true, address: true, contactInfo: true, comments: true },
    });

    if (!charterer) {
      throw new NotFoundException(`Charterer ${id} not found.`);
    }

    return charterer;
  }

  async create(input: ChartererCreateInput) {
    try {
      return await this.prisma.charterer.create({
        data: input,
        select: { id: true, name: true, address: true, contactInfo: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A charterer named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: ChartererUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.charterer.update({
        where: { id },
        data: input,
        select: { id: true, name: true, address: true, contactInfo: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A charterer named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.charterer.delete({ where: { id } });
    this.logger.log({ event: 'charterers.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.charterer.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.charterer.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Charterer ${id} not found.`);
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
