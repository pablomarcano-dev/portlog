import { ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { type Prisma, AuditEvent } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../../audit/audit.service.js';
import type { OwnerCreateInput, OwnerUpdateInput, OwnerListQuery } from '@portlog/schemas';

// Fields that are gated by the "owner.financial" permission.
const SENSITIVE_FIELDS = ['agreements', 'historyJson'] as const;

type OwnerCtx = { userId: string; ip?: string };

@Injectable()
export class OwnersService {
  private readonly logger = new Logger(OwnersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: OwnerListQuery) {
    const { q, limit, cursor } = query;

    const items = await this.prisma.owner.findMany({
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
      select: {
        id: true,
        name: true,
        physicalAddress: true,
        phones: true,
        address: true,
        notes: true,
        comments: true,
      },
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return {
      items: page.map((o) => ({ ...o, label: o.name })),
      nextCursor,
      hasMore,
    };
  }

  async findById(id: string, requesterPermissions: string[]) {
    const owner = await this.prisma.owner.findUnique({ where: { id } });

    if (!owner) {
      throw new NotFoundException(`Owner ${id} not found.`);
    }

    if (!requesterPermissions.includes('owner.financial')) {
      // Strip sensitive financial fields before returning
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { agreements: _agreements, historyJson: _historyJson, ...safe } = owner;
      return safe;
    }

    return owner;
  }

  async create(input: OwnerCreateInput) {
    return this.prisma.owner.create({
      data: {
        ...input,
        historyJson: input.historyJson as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async update(id: string, dto: OwnerUpdateInput, requesterPermissions: string[], ctx: OwnerCtx) {
    await this.assertExists(id);

    const hasSensitive = SENSITIVE_FIELDS.some(
      (f) => f in dto && dto[f as keyof typeof dto] !== undefined,
    );

    if (hasSensitive && !requesterPermissions.includes('owner.financial')) {
      void this.audit.record(AuditEvent.OWNER_FINANCIAL_DENIED, {
        userId: ctx.userId,
        ip: ctx.ip,
      });
      throw new ForbiddenException('owner_financial_permission_required');
    }

    return this.prisma.owner.update({
      where: { id },
      data: {
        ...dto,
        historyJson: dto.historyJson as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async remove(id: string) {
    await this.assertExists(id);
    await this.prisma.owner.delete({ where: { id } });
    this.logger.log({ event: 'owners.delete', id });
  }

  async search(q: string) {
    const items = await this.prisma.owner.findMany({
      take: 20,
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    });
    return items.map((o) => ({ id: o.id, label: o.name }));
  }

  private async assertExists(id: string): Promise<void> {
    const exists = await this.prisma.owner.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException(`Owner ${id} not found.`);
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
