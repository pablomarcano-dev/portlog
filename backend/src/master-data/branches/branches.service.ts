import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { BranchCreate, BranchUpdate, BranchListQuery } from '@portlog/schemas';

const BRANCH_SELECT = {
  id: true,
  name: true,
  code: true,
  comments: true,
} as const;

@Injectable()
export class BranchesService {
  private readonly logger = new Logger(BranchesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: BranchListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.branch.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' as const } },
              { code: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : undefined,
      orderBy: { name: 'asc' },
      select: BRANCH_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((b) => ({ ...b, label: b.name })),
      nextCursor,
      hasMore,
    };
  }

  async getById(id: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id },
      select: BRANCH_SELECT,
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${id} not found.`);
    }

    return branch;
  }

  async create(input: BranchCreate) {
    try {
      return await this.prisma.branch.create({
        data: input,
        select: BRANCH_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A branch with code "${input.code}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: BranchUpdate) {
    await this.assertExists(id);
    try {
      return await this.prisma.branch.update({
        where: { id },
        data: input,
        select: BRANCH_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A branch with code "${input.code ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);

    const inUse = await this.prisma.nomination.count({ where: { branchId: id } });
    if (inUse > 0) {
      throw new ConflictException(
        `Branch ${id} is referenced by ${inUse} nomination(s) and cannot be deleted.`,
      );
    }

    await this.prisma.branch.delete({ where: { id } });
    this.logger.log({ event: 'branches.delete', id });
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.branch.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Branch ${id} not found.`);
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
