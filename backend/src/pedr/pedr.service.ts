import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  isValidPedrStageTransition,
  type CreatePedrInput,
  type UpdatePedrRequirementsInput,
  type PedrStageTransition,
  type PedrListQuery,
} from '@portlog/schemas';

const DETAIL_INCLUDE = {
  nomination: {
    select: {
      id: true,
      voyageNumber: true,
      status: true,
      dateNominated: true,
      shipParticular: { select: { id: true, name: true, callSign: true } },
    },
  },
  createdBy: { select: { id: true, email: true } },
  stageHistory: {
    orderBy: { createdAt: 'asc' as const },
    include: { changedBy: { select: { id: true, email: true } } },
  },
  subDocuments: {
    orderBy: { createdAt: 'asc' as const },
  },
  events: {
    orderBy: { occurredAt: 'asc' as const },
    include: { recordedBy: { select: { id: true, email: true } } },
  },
  documents: {
    orderBy: { createdAt: 'asc' as const },
    include: { createdBy: { select: { id: true, email: true } } },
  },
} satisfies Prisma.PedrInclude;

const LIST_INCLUDE = {
  nomination: {
    select: {
      id: true,
      voyageNumber: true,
      dateNominated: true,
      shipParticular: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.PedrInclude;

@Injectable()
export class PedrService {
  private readonly logger = new Logger(PedrService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePedrInput, userId: string) {
    const { nominationId } = dto;

    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: { id: true, status: true },
    });

    if (!nomination) {
      throw new NotFoundException(`Nomination ${nominationId} not found.`);
    }

    if (nomination.status !== 'CONFIRMED' && nomination.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        `Nomination must be CONFIRMED or IN_PROGRESS to create a PEDR. Current status: ${nomination.status}.`,
      );
    }

    const existing = await this.prisma.pedr.findUnique({
      where: { nominationId },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException(`A PEDR already exists for nomination ${nominationId}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const pedr = await tx.pedr.create({
        data: {
          nominationId,
          currentStage: 'PRE_ARRIVAL',
          createdById: userId,
        },
        include: DETAIL_INCLUDE,
      });

      await tx.pedrStageHistory.create({
        data: {
          pedrId: pedr.id,
          fromStage: null,
          toStage: 'PRE_ARRIVAL',
          changedById: userId,
        },
      });

      this.logger.log({
        event: 'pedr.created',
        pedrId: pedr.id,
        nominationId,
        userId,
      });

      return pedr;
    });
  }

  async list(query: PedrListQuery) {
    const { stage, nominationSearch, pageSize, cursor } = query;

    const where: Prisma.PedrWhereInput = {};

    if (stage) where.currentStage = stage;

    if (nominationSearch) {
      where.nomination = {
        OR: [
          { voyageNumber: { contains: nominationSearch, mode: 'insensitive' } },
          { shipParticular: { name: { contains: nominationSearch, mode: 'insensitive' } } },
        ],
      };
    }

    const items = await this.prisma.pedr.findMany({
      where,
      take: pageSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: LIST_INCLUDE,
    });

    const nextCursor = items.length === pageSize ? items[items.length - 1]?.id : undefined;

    return { items, nextCursor, pageSize };
  }

  async getById(id: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });

    if (!pedr) {
      throw new NotFoundException(`PEDR ${id} not found.`);
    }

    return pedr;
  }

  async getByNominationId(nominationId: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { nominationId },
      include: DETAIL_INCLUDE,
    });

    if (!pedr) {
      throw new NotFoundException(`No PEDR found for nomination ${nominationId}.`);
    }

    return pedr;
  }

  async updateRequirements(id: string, dto: UpdatePedrRequirementsInput, userId: string) {
    const existing = await this.prisma.pedr.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException(`PEDR ${id} not found.`);
    }

    const updated = await this.prisma.pedr.update({
      where: { id },
      data: {
        requirements: JSON.stringify(dto.requirements),
        updatedAt: new Date(),
      },
      include: DETAIL_INCLUDE,
    });

    this.logger.log({ event: 'pedr.requirements.updated', pedrId: id, userId });

    return updated;
  }

  async transition(id: string, dto: PedrStageTransition, userId: string) {
    const existing = await this.prisma.pedr.findUnique({
      where: { id },
      select: { id: true, currentStage: true },
    });

    if (!existing) {
      throw new NotFoundException(`PEDR ${id} not found.`);
    }

    const fromStage = existing.currentStage;
    const { toStage, reason } = dto;

    if (!isValidPedrStageTransition(fromStage, toStage)) {
      throw new BadRequestException({
        message: 'Invalid PEDR stage transition',
        from: fromStage,
        to: toStage,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.pedr.update({
        where: { id },
        data: { currentStage: toStage },
        include: DETAIL_INCLUDE,
      });

      await tx.pedrStageHistory.create({
        data: {
          pedrId: id,
          fromStage,
          toStage,
          changedById: userId,
          reason: reason ?? null,
        },
      });

      this.logger.log({
        event: 'pedr.stage.transition',
        pedrId: id,
        fromStage,
        toStage,
        userId,
        ...(reason ? { reason } : {}),
      });

      return updated;
    });
  }

  async getHistory(id: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pedr) {
      throw new NotFoundException(`PEDR ${id} not found.`);
    }

    return this.prisma.pedrStageHistory.findMany({
      where: { pedrId: id },
      orderBy: { createdAt: 'asc' },
      include: { changedBy: { select: { id: true, email: true } } },
    });
  }

  async getEvents(id: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!pedr) {
      throw new NotFoundException(`PEDR ${id} not found.`);
    }

    return this.prisma.pedrEvent.findMany({
      where: { pedrId: id },
      orderBy: { occurredAt: 'asc' },
      include: { recordedBy: { select: { id: true, email: true } } },
    });
  }
}
