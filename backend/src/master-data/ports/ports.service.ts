import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { PortCreateInput, PortUpdateInput, PortListQuery } from '@portlog/schemas';

const PORT_SELECT = {
  id: true,
  name: true,
  abbreviation: true,
  country: true,
  branchId: true,
  branch: { select: { id: true, name: true, code: true } },
  emails: true,
  emailGroup: true,
  comments: true,
  terminalContacts: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      userId: true,
      recipientType: true,
      user: { select: { id: true, email: true, displayName: true, operationalRole: true } },
    },
  },
} as const;

export interface PortNode {
  id: string;
  name: string;
  abbreviation: string | null;
  country: string | null;
  branchId: string | null;
  emails: string[];
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
    const { q, limit, cursor, branchId } = query;

    const items = await this.prisma.port.findMany({
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
        ...(branchId ? { branchId } : {}),
      },
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
    const { terminalContacts, ...portData } = input;
    try {
      return await this.prisma.port.create({
        data: {
          ...portData,
          terminalContacts: { create: terminalContacts },
        },
        select: PORT_SELECT,
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A port named "${input.name}" already exists.`);
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // update
  // ---------------------------------------------------------------------------
  async update(id: string, input: PortUpdateInput) {
    await this.assertExists(id);
    const { terminalContacts, ...portData } = input;
    try {
      if (terminalContacts === undefined) {
        return await this.prisma.port.update({
          where: { id },
          data: portData,
          select: PORT_SELECT,
        });
      }
      return await this.prisma.$transaction(async (tx) => {
        await tx.terminalContact.deleteMany({ where: { portId: id } });
        return tx.port.update({
          where: { id },
          data: {
            ...portData,
            terminalContacts: { create: terminalContacts },
          },
          select: PORT_SELECT,
        });
      });
    } catch (err: unknown) {
      if (this.isPrismaUniqueViolation(err)) {
        throw new ConflictException(`A port named "${input.name ?? ''}" already exists.`);
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // remove — ADM only (enforced by controller).
  // Any piers under the port go with it: Pier.portId is onDelete: Cascade. There is deliberately
  // no "port still has piers" guard here, despite what this comment claimed until 2026-07-26.
  // ---------------------------------------------------------------------------
  async remove(id: string) {
    await this.assertExists(id);
    try {
      await this.prisma.port.delete({ where: { id } });
    } catch (err: unknown) {
      // Nominations, SOF timesheets and service requests all reference ports
      // ON DELETE RESTRICT — surface as a conflict, not a 500.
      if (this.isPrismaError(err, 'P2003')) {
        throw new ConflictException('Port is referenced by one or more records.');
      }
      throw err;
    }
    this.logger.log({ event: 'ports.delete', id });
  }

  // ---------------------------------------------------------------------------
  // countries — distinct, non-empty country values across all ports (for filters)
  // ---------------------------------------------------------------------------
  async countries(): Promise<string[]> {
    const rows = await this.prisma.port.findMany({
      where: { country: { not: null } },
      distinct: ['country'],
      select: { country: true },
      orderBy: { country: 'asc' },
    });
    return rows.map((r) => r.country).filter((c): c is string => c != null && c.trim() !== '');
  }

  async contactUsers() {
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      orderBy: [{ displayName: 'asc' }, { email: 'asc' }],
      select: {
        id: true,
        email: true,
        displayName: true,
        branchId: true,
        operationalRole: true,
      },
    });
    return { items: users };
  }

  // ---------------------------------------------------------------------------
  // search — quick type-ahead
  // ---------------------------------------------------------------------------
  async search(q: string, branchId?: string) {
    const items = await this.prisma.port.findMany({
      take: 20,
      where: {
        name: { contains: q, mode: 'insensitive' },
        ...(branchId ? { branchId } : {}),
      },
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

  private isPrismaUniqueViolation(err: unknown): boolean {
    return this.isPrismaError(err, 'P2002');
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
