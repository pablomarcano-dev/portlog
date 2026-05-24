import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  AllSentFiltersSchema,
  type AllSentFilters,
  type AllSentResponse,
  type CellStatus,
  type TrackerDocType,
} from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

const TRACKER_TYPES: TrackerDocType[] = ['SH_66A', 'SH_09A', 'SH_28A', 'SH_29A'];

/**
 * Builds a pending cell — no SHDocument exists for this type on this nomination.
 */
function pendingCell(): CellStatus {
  return { status: 'PENDING' };
}

@Controller('all-sent')
@Roles('OPS', 'ADM')
export class AllSentController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getAllSent(
    @Query(new ZodValidationPipe(AllSentFiltersSchema)) filters: AllSentFilters,
  ): Promise<AllSentResponse> {
    // Default filter: last 30 days when no range provided
    const toDate = filters.to ? new Date(filters.to) : new Date();
    const fromDate = filters.from
      ? new Date(filters.from)
      : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    const nominations = await this.prisma.nomination.findMany({
      where: {
        dateNominated: {
          gte: fromDate,
          lte: toDate,
        },
        ...(filters.portId ? { opPortId: filters.portId } : {}),
      },
      include: {
        shipParticular: { select: { name: true } },
        opPort: { select: { name: true, abbreviation: true } },
        shDocuments: {
          where: { type: { in: TRACKER_TYPES } },
          include: {
            dispatches: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { dateNominated: 'desc' },
    });

    const rows: AllSentResponse['rows'] = nominations.map((nom) => {
      // Build a map: docType -> latest dispatch cell status
      const cellMap = new Map<TrackerDocType, CellStatus>();

      for (const doc of nom.shDocuments) {
        const docType = doc.type as TrackerDocType;
        if (!TRACKER_TYPES.includes(docType)) continue;

        const latestDispatch = doc.dispatches[0] ?? null;

        let cell: CellStatus;
        if (doc.status === 'SENT') {
          if (latestDispatch && latestDispatch.error != null) {
            // Dispatch attempted but errored
            cell = {
              status: 'FAILED',
              shDocumentId: doc.id,
              error: latestDispatch.error,
            };
          } else if (latestDispatch && latestDispatch.sentAt != null) {
            cell = {
              status: 'SENT',
              shDocumentId: doc.id,
              sentAt: latestDispatch.sentAt.toISOString(),
            };
          } else {
            // Status is SENT but dispatch row is missing sentAt — treat as pending
            cell = { status: 'PENDING', shDocumentId: doc.id };
          }
        } else {
          // DRAFT or FINALIZED — document exists but not sent
          cell = { status: 'PENDING', shDocumentId: doc.id };
        }

        cellMap.set(docType, cell);
      }

      return {
        nominationId: nom.id,
        correlative: String(nom.correlative),
        vesselName: nom.shipParticular?.name ?? null,
        portName: (nom.opPort as { name?: string } | null)?.name ?? null,
        // TODO: replace with canonical Sucursal model when decided
        // Currently aliased to Port.abbreviation as a stand-in for branch/sucursal grouping
        portAbbreviation: (nom.opPort as { abbreviation?: string } | null)?.abbreviation ?? null,
        etaDate: nom.etaDate?.toISOString() ?? null,
        cells: {
          SH_66A: cellMap.get('SH_66A') ?? pendingCell(),
          SH_09A: cellMap.get('SH_09A') ?? pendingCell(),
          SH_28A: cellMap.get('SH_28A') ?? pendingCell(),
          SH_29A: cellMap.get('SH_29A') ?? pendingCell(),
        },
      };
    });

    return { rows };
  }
}
