import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ActivityCreateInput, ActivityUpdateInput, ActivityListQuery } from '@portlog/schemas';

@Injectable()
export class ActivitiesService {
  private readonly logger = new Logger(ActivitiesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: ActivityListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.activity.findMany({
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
      select: { id: true, name: true, comments: true },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((a) => ({ ...a, label: a.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const activity = await this.prisma.activity.findUnique({
      where: { id },
      select: { id: true, name: true, comments: true },
    });

    if (!activity) {
      throw new NotFoundException(`Activity ${id} not found.`);
    }

    return activity;
  }

  async create(input: ActivityCreateInput) {
    try {
      return await this.prisma.activity.create({
        data: input,
        select: { id: true, name: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An activity named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: ActivityUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.activity.update({
        where: { id },
        data: input,
        select: { id: true, name: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An activity named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.activity.delete({ where: { id } });
    this.logger.log({ event: 'activities.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.activity.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((a) => ({ id: a.id, label: a.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.activity.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Activity ${id} not found.`);
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
