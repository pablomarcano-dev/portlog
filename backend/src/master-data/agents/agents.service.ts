import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { AgentCreateInput, AgentUpdateInput, AgentListQuery } from '@portlog/schemas';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly select = {
    id: true,
    name: true,
    address: true,
    contactInfo: true,
    mobile: true,
    branchId: true,
    branch: { select: { id: true, name: true, code: true } },
    operationalRole: true,
    comments: true,
  } as const;

  async list(query: AgentListQuery) {
    const { q, limit, cursor, branchId, operationalRole } = query;

    const items = await this.prisma.agent.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        ...(branchId ? { branchId } : {}),
        ...(operationalRole ? { operationalRole } : {}),
      },
      orderBy: { name: 'asc' },
      select: this.select,
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

  async getNominationConfigurationHealth() {
    const [total, availableForNominations, partiallyConfigured, unassigned] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.agent.count({
        where: {
          branchId: { not: null },
          operationalRole: { not: null },
        },
      }),
      this.prisma.agent.count({
        where: {
          OR: [
            { branchId: null, operationalRole: { not: null } },
            { branchId: { not: null }, operationalRole: null },
          ],
        },
      }),
      this.prisma.agent.count({
        where: {
          branchId: null,
          operationalRole: null,
        },
      }),
    ]);

    return {
      total,
      availableForNominations,
      unavailableForNominations: total - availableForNominations,
      partiallyConfigured,
      unassigned,
    };
  }

  async getById(id: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id },
      select: this.select,
    });

    if (!agent) {
      throw new NotFoundException(`Agent ${id} not found.`);
    }

    return agent;
  }

  async create(input: AgentCreateInput) {
    try {
      return await this.prisma.agent.create({
        data: input,
        select: this.select,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An agent named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  async update(id: string, input: AgentUpdateInput) {
    await this.assertExists(id);
    try {
      return await this.prisma.agent.update({
        where: { id },
        data: input,
        select: this.select,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`An agent named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.agent.delete({ where: { id } });
    this.logger.log({ event: 'agents.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.agent.findMany({
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
    const exists = await this.prisma.agent.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Agent ${id} not found.`);
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
