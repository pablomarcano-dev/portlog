import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CrewCreateInput, CrewUpdateInput, CrewListQuery } from '@portlog/schemas';

const CREW_SELECT = {
  id: true,
  name: true,
  position: true,
  documentNumber: true,
  nationality: true,
  comments: true,
} as const;

@Injectable()
export class CrewService {
  private readonly logger = new Logger(CrewService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor-based list with optional full-text search on `name`.
   * Returns `limit + 1` rows so the caller can detect `hasMore`.
   */
  async list(query: CrewListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.crew.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined,
      orderBy: { name: 'asc' },
      select: CREW_SELECT,
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
    const crew = await this.prisma.crew.findUnique({
      where: { id },
      select: CREW_SELECT,
    });

    if (!crew) {
      throw new NotFoundException(`Crew ${id} not found.`);
    }

    return crew;
  }

  async create(input: CrewCreateInput) {
    try {
      return await this.prisma.crew.create({
        data: input,
        select: CREW_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A crew member named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: CrewUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.crew.update({
        where: { id },
        data: input,
        select: CREW_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A crew member named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.crew.delete({ where: { id } });
    this.logger.log({ event: 'crew.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.crew.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.crew.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Crew ${id} not found.`);
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
