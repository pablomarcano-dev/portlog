import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isValidTransition,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationListQuery,
} from '@portlog/schemas';

function formatSnOt(correlative: number, dateNominated: Date): string {
  const yy = String(dateNominated.getFullYear()).slice(-2);
  return `SN-${yy}/${String(correlative).padStart(4, '0')}`;
}

const DETAIL_INCLUDE = {
  shipParticular: {
    select: { id: true, name: true, callSign: true, imoNumber: true, abbreviation: true },
  },
  operator: { select: { id: true, name: true } },
  charter: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true } },
  shipper: { select: { id: true, name: true } },
  agent: { select: { id: true, name: true } },
  opPort: { select: { id: true, name: true, abbreviation: true } },
  berthPort: { select: { id: true, name: true, abbreviation: true } },
  lastPort: { select: { id: true, name: true, abbreviation: true } },
  nextPort: { select: { id: true, name: true, abbreviation: true } },
  disPort: { select: { id: true, name: true, abbreviation: true } },
  createdBy: { select: { id: true, email: true } },
  nominatedBy: { select: { id: true, email: true } },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    include: { changedBy: { select: { id: true, email: true } } },
  },
} satisfies Prisma.NominationInclude;

const LIST_INCLUDE = {
  shipParticular: { select: { id: true, name: true, callSign: true } },
  opPort: { select: { id: true, name: true, abbreviation: true } },
} satisfies Prisma.NominationInclude;

@Injectable()
export class NominationsService {
  private readonly logger = new Logger(NominationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: NominationCreateInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const nomination = await tx.nomination.create({
        data: { ...(dto as unknown as Prisma.NominationUncheckedCreateInput), createdById: userId },
        include: DETAIL_INCLUDE,
      });
      await tx.nominationStatusHistory.create({
        data: {
          nominationId: nomination.id,
          fromStatus: null,
          toStatus: 'DRAFT',
          changedById: userId,
        },
      });
      this.logger.log({
        event: 'nomination.created',
        nominationId: nomination.id,
        correlative: nomination.correlative,
        userId,
      });
      return { ...nomination, snOt: formatSnOt(nomination.correlative, nomination.dateNominated) };
    });
  }

  async list(query: NominationListQuery) {
    const { page, pageSize, status, portId, shipParticularId, dateFrom, dateTo, search } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.NominationWhereInput = {};

    if (status) where.status = status;
    if (shipParticularId) where.shipParticularId = shipParticularId;
    if (portId) {
      where.OR = [
        { opPortId: portId },
        { berthPortId: portId },
        { lastPortId: portId },
        { nextPortId: portId },
        { disPortId: portId },
      ];
    }
    if (dateFrom || dateTo) {
      where.dateNominated = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }
    if (search) {
      const correlativeNum = parseInt(search, 10);
      const searchClauses: Prisma.NominationWhereInput[] = [
        { voyageNumber: { contains: search, mode: 'insensitive' } },
        { shipParticular: { name: { contains: search, mode: 'insensitive' } } },
      ];
      if (!isNaN(correlativeNum)) {
        searchClauses.push({ correlative: correlativeNum });
      }
      where.OR = searchClauses;
    }

    const [items, total] = await Promise.all([
      this.prisma.nomination.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: LIST_INCLUDE,
      }),
      this.prisma.nomination.count({ where }),
    ]);

    return {
      items: items.map((n) => ({
        ...n,
        snOt: formatSnOt(n.correlative, n.dateNominated),
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string) {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!nomination) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }
    return { ...nomination, snOt: formatSnOt(nomination.correlative, nomination.dateNominated) };
  }

  async update(id: string, dto: NominationUpdateInput, userId: string) {
    const existing = await this.prisma.nomination.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }
    if (existing.status === 'COMPLETED' || existing.status === 'CANCELLED') {
      throw new ConflictException(
        `Nomination is in terminal state ${existing.status} and cannot be updated.`,
      );
    }
    try {
      const updated = await this.prisma.nomination.update({
        where: { id },
        data: {
          ...(dto as unknown as Prisma.NominationUncheckedUpdateInput),
          updatedAt: new Date(),
        },
        include: DETAIL_INCLUDE,
      });
      this.logger.log({ event: 'nomination.updated', nominationId: id, userId });
      return { ...updated, snOt: formatSnOt(updated.correlative, updated.dateNominated) };
    } catch (err: unknown) {
      if (this.isFkViolation(err)) {
        throw new BadRequestException('Invalid foreign key reference.');
      }
      throw err;
    }
  }

  async transition(id: string, dto: NominationStatusTransition, userId: string) {
    const existing = await this.prisma.nomination.findUnique({
      where: { id },
      select: { id: true, status: true, correlative: true },
    });
    if (!existing) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }

    const { toStatus, reason } = dto;
    const fromStatus = existing.status;

    if (!isValidTransition(fromStatus, toStatus)) {
      throw new BadRequestException({
        message: 'Invalid transition',
        from: fromStatus,
        to: toStatus,
      });
    }

    if (toStatus === 'CANCELLED' && !reason) {
      throw new BadRequestException('reason is required when cancelling a nomination.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nomination.update({
        where: { id },
        data: { status: toStatus },
        include: DETAIL_INCLUDE,
      });
      await tx.nominationStatusHistory.create({
        data: {
          nominationId: id,
          fromStatus,
          toStatus,
          changedById: userId,
          reason: reason ?? null,
        },
      });
      this.logger.log({
        event: 'nomination.transition',
        nominationId: id,
        correlative: existing.correlative,
        fromStatus,
        toStatus,
        userId,
        ...(reason ? { reason } : {}),
      });
      return { ...updated, snOt: formatSnOt(updated.correlative, updated.dateNominated) };
    });
  }

  delete(): never {
    throw new MethodNotAllowedException(
      'Nominations cannot be deleted. Use POST /:id/transition with toStatus=CANCELLED.',
    );
  }

  private isFkViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';
  }
}
