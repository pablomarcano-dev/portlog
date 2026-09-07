import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  deriveNominationStatus,
  NominationParcelReadSchema,
  PublicNominationListResponseSchema,
  PublicNominationResponseSchema,
  type NominationKind,
  type NominationStatus,
  type PublicNominationListQuery,
} from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';

const STATUS_INCLUDE = {
  pedr: {
    select: {
      emailDispatches: {
        where: { subDocType: { in: ['PREARRIVAL', 'SOF'] as const }, sentAt: { not: null } },
        select: { subDocType: true },
      },
    },
  },
} satisfies Prisma.NominationInclude;

const LIST_INCLUDE = {
  shipParticular: { select: { name: true, callSign: true, imoNumber: true } },
  opPort: { select: { name: true, abbreviation: true } },
  ...STATUS_INCLUDE,
} satisfies Prisma.NominationInclude;

const DETAIL_INCLUDE = {
  shipParticular: {
    select: {
      name: true,
      callSign: true,
      imoNumber: true,
      loa: true,
      grt: true,
      nrt: true,
      flag: { select: { name: true } },
    },
  },
  client: { select: { name: true } },
  opPort: { select: { name: true, abbreviation: true } },
  pier: { select: { name: true } },
  lastPort: { select: { name: true, abbreviation: true } },
  nextPort: { select: { name: true, abbreviation: true } },
  disPort: { select: { name: true, abbreviation: true } },
  nominationClients: { orderBy: { sortOrder: 'asc' as const } },
  ...STATUS_INCLUDE,
} satisfies Prisma.NominationInclude;

type StatusRow = {
  status: NominationStatus;
  layDaysFirst: Date | null;
  layDaysLast: Date | null;
  pedr: { emailDispatches: { subDocType: string }[] } | null;
};

function statusOf(row: StatusRow, now: Date): NominationStatus {
  const sent = row.pedr?.emailDispatches ?? [];
  return deriveNominationStatus({
    cancelled: row.status === 'CANCELLED',
    prearrivalSent: sent.some((dispatch) => dispatch.subDocType === 'PREARRIVAL'),
    sofSent: sent.some((dispatch) => dispatch.subDocType === 'SOF'),
    layDaysFirst: row.layDaysFirst,
    layDaysLast: row.layDaysLast,
    now,
  });
}

function reference(correlative: number, nominatedAt: Date, kind: NominationKind): string {
  const year = String(nominatedAt.getUTCFullYear()).slice(-2);
  return `${kind}-${year}/${String(correlative).padStart(4, '0')}`;
}

function statusWhere(status: NominationStatus, now: Date): Prisma.NominationWhereInput {
  const prearrivalSent: Prisma.NominationWhereInput = {
    pedr: { emailDispatches: { some: { subDocType: 'PREARRIVAL', sentAt: { not: null } } } },
  };
  const sofSent: Prisma.NominationWhereInput = {
    pedr: { emailDispatches: { some: { subDocType: 'SOF', sentAt: { not: null } } } },
  };
  const inPort: Prisma.NominationWhereInput = {
    AND: [prearrivalSent, { layDaysFirst: { lt: now } }],
  };
  const fullAway: Prisma.NominationWhereInput = {
    AND: [sofSent, { layDaysLast: { lt: now } }],
  };
  const active: Prisma.NominationWhereInput = { status: { not: 'CANCELLED' } };

  if (status === 'CANCELLED') return { status: 'CANCELLED' };
  if (status === 'FULL_AWAY') return { AND: [active, fullAway] };
  if (status === 'IN_PORT') return { AND: [active, inPort, { NOT: fullAway }] };
  return { AND: [active, { NOT: inPort }, { NOT: fullAway }] };
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

@Injectable()
export class PublicNominationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PublicNominationListQuery) {
    const now = new Date();
    const where = query.status ? statusWhere(query.status, now) : {};
    const sortDescending = query.sort.startsWith('-');
    const publicSortField = sortDescending ? query.sort.slice(1) : query.sort;
    const databaseSortField =
      publicSortField === 'nominatedAt'
        ? 'dateNominated'
        : publicSortField === 'eta'
          ? 'etaDate'
          : publicSortField;
    const direction: Prisma.SortOrder = sortDescending ? 'desc' : 'asc';
    const orderBy = [
      { [databaseSortField]: direction },
      { id: direction },
    ] as Prisma.NominationOrderByWithRelationInput[];
    const [rows, totalItems] = await Promise.all([
      this.prisma.nomination.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy,
        include: LIST_INCLUDE,
      }),
      this.prisma.nomination.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / query.pageSize);
    return PublicNominationListResponseSchema.parse({
      data: rows.map((row) => ({
        id: row.id,
        reference: reference(row.correlative, row.dateNominated, row.kind),
        kind: row.kind,
        status: statusOf(row, now),
        nominationType: row.nominationType,
        voyage: { number: row.voyageNumber, code: row.voyageCode },
        vessel: row.shipParticular,
        operatingPort: row.opPort,
        nominatedAt: row.dateNominated.toISOString(),
        eta: iso(row.etaDate),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPreviousPage: query.page > 1,
      },
    });
  }

  async byId(id: string) {
    const row = await this.prisma.nomination.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row) throw new NotFoundException('Nomination was not found.');

    const cargoResult = NominationParcelReadSchema.array().safeParse(row.parcels);
    const cargo = cargoResult.success ? cargoResult.data : [];
    const now = new Date();

    return PublicNominationResponseSchema.parse({
      data: {
        id: row.id,
        reference: reference(row.correlative, row.dateNominated, row.kind),
        kind: row.kind,
        status: statusOf(row, now),
        nominationType: row.nominationType,
        voyage: { number: row.voyageNumber, code: row.voyageCode },
        vessel: {
          name: row.shipParticular.name,
          callSign: row.shipParticular.callSign,
          imoNumber: row.shipParticular.imoNumber,
          flag: row.shipParticular.flag?.name ?? null,
          loa: row.shipParticular.loa == null ? null : Number(row.shipParticular.loa),
          grt: row.shipParticular.grt == null ? null : Number(row.shipParticular.grt),
          nrt: row.shipParticular.nrt == null ? null : Number(row.shipParticular.nrt),
        },
        client: row.client,
        ports: {
          operating: row.opPort,
          pier: row.pier,
          last: row.lastPort,
          next: row.nextPort,
          discharge: row.disPort,
        },
        dates: {
          nominatedAt: row.dateNominated.toISOString(),
          nominationRepliedAt: iso(row.nomReply),
          laycanFrom: iso(row.layDaysFirst),
          laycanTo: iso(row.layDaysLast),
          eta: iso(row.etaDate),
        },
        contacts: {
          master: row.master,
          broker: row.broker,
          boardingClerk: row.boardingClerk,
          inspector: row.inspector,
        },
        subject: row.subject,
        referenceNumber: row.referenceNo,
        cargo: cargo.map((parcel) => ({
          product: parcel.product,
          quantity: parcel.quantity ?? null,
          unit: parcel.unit,
          operation: parcel.operation ?? null,
          estimatedCompletionAt:
            parcel.etcDate && parcel.etcTime ? `${parcel.etcDate}T${parcel.etcTime}:00` : null,
          quantityOnBoard: parcel.qtyOnBoard ?? null,
          quantityToGo: parcel.qtyToGo ?? null,
          loadingRate: parcel.loadingRate ?? null,
          loadingRateUnit: parcel.loadingRateUnit ?? null,
        })),
        parties: row.nominationClients.map((party) => ({
          type: party.type,
          name: party.name,
          voyageReference: party.voyageRef,
          referenceNumber: party.referenceNo,
          proforma: party.proforma,
          broker: party.broker,
        })),
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      },
    });
  }
}
