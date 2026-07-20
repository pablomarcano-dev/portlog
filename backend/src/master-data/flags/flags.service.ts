import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { FlagCreateInput, FlagUpdateInput, FlagListQuery } from '@portlog/schemas';

@Injectable()
export class FlagsService {
  private readonly logger = new Logger(FlagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cursor-based list with optional full-text search on `name`.
   * Returns `limit + 1` rows so the caller can detect `hasMore`.
   */
  async list(query: FlagListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.flag.findMany({
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
      select: { id: true, name: true, abbreviation: true, comments: true },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((f) => ({ ...f, label: f.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const flag = await this.prisma.flag.findUnique({
      where: { id },
      select: { id: true, name: true, abbreviation: true, comments: true },
    });

    if (!flag) {
      throw new NotFoundException(`Flag ${id} not found.`);
    }

    return flag;
  }

  async create(input: FlagCreateInput) {
    try {
      return await this.prisma.flag.create({
        data: {
          ...input,
          abbreviation: input.abbreviation?.trim() || this.deriveAbbreviation(input.name),
        },
        select: { id: true, name: true, abbreviation: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A flag named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: FlagUpdateInput) {
    await this.assertExists(id);
    // When the abbreviation is cleared alongside a name, re-derive the default.
    const data: FlagUpdateInput = { ...input };
    if (data.abbreviation !== undefined && data.name !== undefined) {
      data.abbreviation = data.abbreviation.trim() || this.deriveAbbreviation(data.name);
    }
    try {
      return await this.prisma.flag.update({
        where: { id },
        data,
        select: { id: true, name: true, abbreviation: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A flag named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.flag.delete({ where: { id } });
    this.logger.log({ event: 'flags.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.flag.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((f) => ({ id: f.id, label: f.name }));
  }

  /** Default abbreviation: the first 3 letters of the country name, uppercased. */
  private deriveAbbreviation(name: string): string {
    return name.trim().slice(0, 3).toUpperCase();
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.flag.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Flag ${id} not found.`);
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
