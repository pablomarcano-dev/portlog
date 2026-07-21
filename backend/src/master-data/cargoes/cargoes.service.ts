import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type {
  CargoCreateInput,
  CargoUpdateInput,
  CargoListQuery,
  CargoCategory,
} from '@portlog/schemas';

@Injectable()
export class CargoesService {
  private readonly logger = new Logger(CargoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async list(query: CargoListQuery) {
    const { q, limit, cursor, category } = query;

    const items = await this.prisma.cargo.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, bblUnit: true, category: true, comments: true },
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
    const cargo = await this.prisma.cargo.findUnique({
      where: { id },
      select: { id: true, name: true, bblUnit: true, category: true, comments: true },
    });

    if (!cargo) {
      throw new NotFoundException(`Cargo ${id} not found.`);
    }

    return cargo;
  }

  async create(input: CargoCreateInput) {
    try {
      return await this.prisma.cargo.create({
        data: input,
        select: { id: true, name: true, bblUnit: true, category: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A cargo named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: CargoUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.cargo.update({
        where: { id },
        data: input,
        select: { id: true, name: true, bblUnit: true, category: true, comments: true },
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A cargo named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.cargo.delete({ where: { id } });
    this.logger.log({ event: 'cargoes.delete', id });
  }

  async search(q: string, category?: CargoCategory) {
    const items = await this.prisma.cargo.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
        ...(category ? { category } : {}),
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, category: true },
    });
    return items.map((c) => ({ id: c.id, label: c.name, category: c.category }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.cargo.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Cargo ${id} not found.`);
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
