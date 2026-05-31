import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PortCreateInput, PortUpdateInput, PortListQuery } from '@portlog/schemas';

const PORT_SELECT = {
  id: true,
  name: true,
  abbreviation: true,
  country: true,
  emailGroup: true,
  comments: true,
} as const;

export interface PortNode {
  id: string;
  name: string;
  abbreviation: string | null;
  country: string | null;
  emailGroup: string | null;
  comments: string | null;
}

@Injectable()
export class PortsService {
  private readonly logger = new Logger(PortsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // list — cursor-paginated with optional name search
  // ---------------------------------------------------------------------------
  async list(query: PortListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.port.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: q ? { name: { contains: q, mode: 'insensitive' as const } } : {},
      orderBy: { name: 'asc' },
      select: PORT_SELECT,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((p) => ({ ...p, label: p.name })),
      nextCursor,
      hasMore,
    };
  }

  // ---------------------------------------------------------------------------
  // getById — includes piers list
  // ---------------------------------------------------------------------------
  async getById(id: string) {
    const port = await this.prisma.port.findUnique({
      where: { id },
      select: {
        ...PORT_SELECT,
        piers: {
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!port) {
      throw new NotFoundException(`Port ${id} not found.`);
    }

    return port;
  }

  // ---------------------------------------------------------------------------
  // create
  // ---------------------------------------------------------------------------
  async create(input: PortCreateInput) {
    return await this.prisma.port.create({
      data: input,
      select: PORT_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  async update(id: string, input: PortUpdateInput) {
    await this.assertExists(id);
    return await this.prisma.port.update({
      where: { id },
      data: input,
      select: PORT_SELECT,
    });
  }

  // ---------------------------------------------------------------------------
  // remove — only when port has no piers; ADM only (enforced by controller)
  // ---------------------------------------------------------------------------
  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.port.delete({ where: { id } });
    this.logger.log({ event: 'ports.delete', id });
  }

  // ---------------------------------------------------------------------------
  // search — quick type-ahead
  // ---------------------------------------------------------------------------
  async search(q: string) {
    const items = await this.prisma.port.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((p) => ({ id: p.id, label: p.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.port.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Port ${id} not found.`);
    }
  }
}
