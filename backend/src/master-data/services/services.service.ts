import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { ServiceCreateInput, ServiceUpdateInput, ServiceListQuery } from '@portlog/schemas';

const SERVICE_SELECT = {
  id: true,
  name: true,
  comments: true,
} as const;

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Cursor-based list with optional full-text search on `name`.
   *  Returns `limit + 1` rows so the caller can detect `hasMore`. */
  async list(query: ServiceListQuery) {
    const { q, limit, cursor } = query;
    const items = await this.prisma.service.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : undefined,
      orderBy: { name: 'asc' },
      select: SERVICE_SELECT,
    });
    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
    return { items: page.map((s) => ({ ...s, label: s.name })), nextCursor, hasMore };
  }

  async getById(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      select: SERVICE_SELECT,
    });
    if (!service) throw new NotFoundException(`Service ${id} not found.`);
    return service;
  }

  async create(input: ServiceCreateInput) {
    try {
      return await this.prisma.service.create({ data: input, select: SERVICE_SELECT });
    } catch (err: unknown) {
      if (this.isPrismaError(err, 'P2002'))
        throw new ConflictException(`A service named "${input.name}" already exists.`);
      throw err;
    }
  }

  async update(id: string, input: ServiceUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.service.update({
        where: { id },
        data: input,
        select: SERVICE_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaError(err, 'P2002'))
        throw new ConflictException(`A service named "${input.name ?? ''}" already exists.`);
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    try {
      await this.prisma.service.delete({ where: { id } });
    } catch (err: unknown) {
      // sales.serviceId is ON DELETE RESTRICT — surface as a conflict, not a 500
      if (this.isPrismaError(err, 'P2003'))
        throw new ConflictException('Service is referenced by one or more sales.');
      throw err;
    }
    this.logger.log({ event: 'service.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.service.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((s) => ({ id: s.id, label: s.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.service.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Service ${id} not found.`);
  }

  private isPrismaError(err: unknown, code: string): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === code
    );
  }
}
