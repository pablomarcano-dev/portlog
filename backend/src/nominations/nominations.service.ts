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
import { EmailService } from '../email/email.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { EmailTemplateService } from '../email-templates/email-template.service.js';
import { wrapPlainTextEmailBody } from '../email/email-body.util.js';
import {
  isValidTransition,
  deriveNominationStatus,
  MONTH_ABBR,
  ordinalDay,
  formatNoticeDate,
  formatNoticeDateRange,
  formatCargoFigure,
  formatQuantity,
  resolveTransferRateUnit,
  type NominationStatus,
  type NominationKind,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationListQuery,
  type NominationClientCreate,
  type NominationClientUpdate,
  type SaleCreate,
  type SaleUpdate,
  type ComposeData,
  type EtaRecordSaveInput,
  type SofTimesheetInput,
  type SendNominationEmailInput,
} from '@portlog/schemas';

function formatSnOt(correlative: number, dateNominated: Date, kind: NominationKind): string {
  const yy = String(dateNominated.getFullYear()).slice(-2);
  const prefix = kind === 'OT' ? 'OT' : 'SN';
  return `${prefix}-${yy}/${String(correlative).padStart(4, '0')}`;
}

/**
 * Sub-document action type → template file under `templates/`.
 *
 * Every action the compose drawer can open must appear here. An unmapped type
 * falls through to `<action>.hbs`, which does not exist — NOR shipped that way
 * and the drawer opened with no subject, no recipients and no body, since the
 * whole compose request failed. Covered by a spec that stats each path.
 */
export const COMPOSE_TEMPLATE_PATHS: Record<string, string> = {
  ACKNOWLEDGEMENT: '01_prearrival/00_nomination_acceptance.hbs',
  PREARRIVAL: '01_prearrival/10_prearrival_notification.hbs',
  ETA_REQUEST: '01_prearrival/01_eta_request_to_master.hbs',
  ETA_TERMINAL: '01_prearrival/03_eta_forwarded_to_terminal.hbs',
  ETA_REPLY: '01_prearrival/02_reply_to_master_eta_notice.hbs',
  NOR: '01_prearrival/06_nor_tendered_to_terminal.hbs',
  CARGO_UPDATE: '02_statement_of_facts/07_cargo_update.hbs',
  SOF: '02_statement_of_facts/15_final_sof.hbs',
};

/**
 * Actions addressed to the terminal and the shipper rather than to the
 * nomination's own client list. Both notices concern the vessel's readiness at
 * the berth, so they go to the people at the berth — see the recipient block in
 * getComposeData.
 */
const TERMINAL_ADDRESSED_ACTIONS = new Set(['ETA_TERMINAL', 'NOR']);

/**
 * Laycan-style date range with the month spelled out, e.g.
 * "Jul. 06th-10th, 2026". The month and year collapse when both ends share
 * them, which is the common case — laydays are usually a few days apart.
 * Either end may be missing; a single date renders on its own.
 */
export function formatLaydayRange(first: Date | null, last: Date | null): string {
  const one = (d: Date) =>
    `${MONTH_ABBR[d.getMonth()]}. ${ordinalDay(d.getDate())}, ${d.getFullYear()}`;

  if (first && last) {
    if (first.getFullYear() !== last.getFullYear()) return `${one(first)} - ${one(last)}`;
    if (first.getMonth() !== last.getMonth()) {
      return `${MONTH_ABBR[first.getMonth()]}. ${ordinalDay(first.getDate())} - ${MONTH_ABBR[last.getMonth()]}. ${ordinalDay(last.getDate())}, ${last.getFullYear()}`;
    }
    return `${MONTH_ABBR[first.getMonth()]}. ${ordinalDay(first.getDate())}-${ordinalDay(last.getDate())}, ${first.getFullYear()}`;
  }

  const only = first ?? last;
  return only ? one(only) : '';
}

/**
 * Thousands-grouped cargo figure, e.g. 1900000 -> "1,900,000". Locale is pinned
 * so the rendered notice never depends on the server's environment. Anything
 * non-numeric passes through untouched rather than becoming "NaN" or "0".
 */
/**
 * Cargo-update ETC stamp for the notice body, e.g. "02/08/2026 02:00".
 *
 * The Cargo Update modal stores the picked value split across `etcDate`
 * (`YYYY-MM-DD`) and `etcTime` (`HH:mm`) — deliberately zone-less, because ETC
 * is a *port-local wall clock*, not an instant. Reformatting textually rather
 * than through `Date` keeps the server's timezone from shifting the hour on a
 * legally binding notice. Values that don't match (legacy free-typed dates)
 * pass through untouched. 24-hour, never AM/PM.
 */
export function formatEtcStamp(date: unknown, time: unknown): string {
  const rawDate = date === null || date === undefined ? '' : String(date).trim();
  const rawTime = time === null || time === undefined ? '' : String(time).trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate);
  const datePart = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : rawDate;

  return [datePart, rawTime].filter(Boolean).join(' ');
}

export function formatCargoQuantity(value: unknown): string {
  if (value === null || value === undefined || value === '') return '';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return String(value);
  return new Intl.NumberFormat('en-US').format(n);
}

/**
 * Distinct addresses, preserving order and dropping blanks.
 *
 * Matching is case-insensitive because the local part is the only case-sensitive
 * piece of an address in theory and never in practice, and the same terminal
 * address is routinely registered with different casing in two places. The first
 * spelling seen is the one kept.
 */
export function dedupeEmails(addresses: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of addresses) {
    const address = raw.trim();
    if (address === '') continue;
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(address);
  }
  return out;
}

// Fetches the sent PREARRIVAL / SOF dispatches used to derive the operational
// status (IN_PORT / FULL_AWAY). Merged into DETAIL_INCLUDE and LIST_INCLUDE.
const STATUS_FACTS_INCLUDE = {
  pedr: {
    select: {
      emailDispatches: {
        where: { subDocType: { in: ['PREARRIVAL', 'SOF'] as const }, sentAt: { not: null } },
        select: { subDocType: true },
      },
    },
  },
} satisfies Prisma.NominationInclude;

type StatusFacts = {
  status: NominationStatus;
  correlative: number;
  dateNominated: Date;
  kind: NominationKind;
  layDaysFirst: Date | null;
  layDaysLast: Date | null;
  pedr: { emailDispatches: { subDocType: string }[] } | null;
};

// Strips the internal `pedr` facts, replaces `status` with the derived value, and
// attaches snOt — the canonical shape returned by every nomination read.
function present<T extends StatusFacts>(n: T, now: Date = new Date()) {
  const { pedr, ...rest } = n;
  const dispatches = pedr?.emailDispatches ?? [];
  const status = deriveNominationStatus({
    cancelled: rest.status === 'CANCELLED',
    prearrivalSent: dispatches.some((d) => d.subDocType === 'PREARRIVAL'),
    sofSent: dispatches.some((d) => d.subDocType === 'SOF'),
    layDaysFirst: rest.layDaysFirst,
    layDaysLast: rest.layDaysLast,
    now,
  });
  return { ...rest, status, snOt: formatSnOt(rest.correlative, rest.dateNominated, rest.kind) };
}

// Translates a derived-status filter into a Prisma where clause so list filtering
// and pagination stay correct without a stored column for IN_PORT / FULL_AWAY.
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
  const notCancelled: Prisma.NominationWhereInput = { status: { not: 'CANCELLED' } };

  switch (status) {
    case 'CANCELLED':
      return { status: 'CANCELLED' };
    case 'FULL_AWAY':
      return { AND: [notCancelled, fullAway] };
    case 'IN_PORT':
      return { AND: [notCancelled, inPort, { NOT: fullAway }] };
    case 'NOMINATED':
    default:
      return { AND: [notCancelled, { NOT: inPort }, { NOT: fullAway }] };
  }
}

const DETAIL_INCLUDE = {
  shipParticular: {
    select: {
      id: true,
      name: true,
      callSign: true,
      imoNumber: true,
      abbreviation: true,
      loa: true,
      grt: true,
      nrt: true,
      flag: { select: { name: true } },
    },
  },
  branch: { select: { id: true, name: true, code: true, contactName: true, contactTitle: true } },
  opPort: { select: { id: true, name: true, abbreviation: true } },
  pier: { select: { id: true, name: true } },
  lastPort: { select: { id: true, name: true, abbreviation: true } },
  nextPort: { select: { id: true, name: true, abbreviation: true } },
  disPort: { select: { id: true, name: true, abbreviation: true } },
  createdBy: { select: { id: true, email: true } },
  nominatedBy: { select: { id: true, email: true } },
  statusHistory: {
    orderBy: { createdAt: 'desc' as const },
    include: { changedBy: { select: { id: true, email: true } } },
  },
  nominationClients: { orderBy: { sortOrder: 'asc' as const } },
  ...STATUS_FACTS_INCLUDE,
} satisfies Prisma.NominationInclude;

const LIST_INCLUDE = {
  shipParticular: { select: { id: true, name: true, callSign: true } },
  opPort: { select: { id: true, name: true, abbreviation: true } },
  ...STATUS_FACTS_INCLUDE,
} satisfies Prisma.NominationInclude;

const SALE_INCLUDE = {
  client: { select: { id: true, name: true } },
  service: { select: { id: true, name: true } },
  port: { select: { id: true, name: true } },
  driver: { select: { id: true, name: true } },
  user: { select: { id: true, name: true } },
} satisfies Prisma.SaleInclude;

@Injectable()
export class NominationsService {
  private readonly logger = new Logger(NominationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly attachmentsService: AttachmentsService,
    private readonly emailTemplates: EmailTemplateService,
  ) {}

  async create(dto: NominationCreateInput, userId: string) {
    const { nominationClients: clientRows, ...nominationData } = dto;
    return this.prisma.$transaction(async (tx) => {
      // OT nominations may only carry OT-category products (no-op for SN).
      await this.assertParcelsMatchKind(tx, nominationData.kind, nominationData.parcels);
      const nomination = await tx.nomination.create({
        data: {
          ...(nominationData as unknown as Prisma.NominationUncheckedCreateInput),
          voyageNumber: nominationData.voyageNumber ?? '',
          createdById: userId,
        },
        include: DETAIL_INCLUDE,
      });
      if (!nominationData.voyageNumber) {
        await tx.nomination.update({
          where: { id: nomination.id },
          data: { voyageNumber: String(nomination.correlative) },
        });
        nomination.voyageNumber = String(nomination.correlative);
      }
      await tx.nominationStatusHistory.create({
        data: {
          nominationId: nomination.id,
          fromStatus: null,
          toStatus: 'NOMINATED',
          changedById: userId,
        },
      });
      // Auto-create the PEDR up front. The lifecycle no longer has a manual
      // "Start" step, and sending the prearrival message (which drives IN_PORT)
      // requires a PEDR to exist.
      const pedr = await tx.pedr.create({
        data: {
          nominationId: nomination.id,
          currentStage: 'PRE_ARRIVAL',
          createdById: userId,
        },
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
        nominationId: nomination.id,
        userId,
        trigger: 'nomination.created',
      });
      if (clientRows && clientRows.length > 0) {
        await tx.nominationClient.createMany({
          data: clientRows.map((row, i) => ({
            ...row,
            nominationId: nomination.id,
            sortOrder: row.sortOrder ?? i,
          })),
        });
        nomination.nominationClients = await tx.nominationClient.findMany({
          where: { nominationId: nomination.id },
          orderBy: { sortOrder: 'asc' },
        });
      }
      this.logger.log({
        event: 'nomination.created',
        nominationId: nomination.id,
        correlative: nomination.correlative,
        userId,
      });
      return present(nomination);
    });
  }

  // OT nominations only accept products marked with the OT cargo category. Parcels
  // store the product as a free-text name, so each is resolved against the OT catalog
  // (case-insensitive). A missing or non-OT product rejects the whole write with 400.
  // No-op for SN nominations, which stay unrestricted.
  private async assertParcelsMatchKind(
    tx: Prisma.TransactionClient,
    kind: NominationKind,
    parcels: { product?: string | null }[] | undefined,
  ): Promise<void> {
    if (kind !== 'OT' || !parcels || parcels.length === 0) return;

    const names = Array.from(
      new Set(
        parcels
          .map((p) => p.product?.trim())
          .filter((n): n is string => !!n)
          .map((n) => n),
      ),
    );
    if (names.length === 0) return;

    const otCargoes = await tx.cargo.findMany({
      where: {
        category: 'OT',
        OR: names.map((n) => ({ name: { equals: n, mode: 'insensitive' as const } })),
      },
      select: { name: true },
    });
    const otNames = new Set(otCargoes.map((c) => c.name.toLowerCase()));

    const offenders = Array.from(new Set(names.filter((n) => !otNames.has(n.toLowerCase()))));
    if (offenders.length > 0) {
      throw new BadRequestException(
        `OT nominations only accept products marked OT. Not OT-eligible: ${offenders.join(', ')}.`,
      );
    }
  }

  async list(query: NominationListQuery) {
    const { page, pageSize, status, portId, country, shipParticularId, dateFrom, dateTo, search } =
      query;
    const skip = (page - 1) * pageSize;

    const now = new Date();
    const where: Prisma.NominationWhereInput = {};
    // Each independent filter that needs an OR across the several port relations
    // is pushed as its own AND clause so the groups don't clobber one another.
    const and: Prisma.NominationWhereInput[] = [];

    // Status is derived (IN_PORT / FULL_AWAY are not stored), so a status filter
    // is translated into an equivalent where clause to keep pagination correct.
    if (status) and.push(statusWhere(status, now));
    if (shipParticularId) where.shipParticularId = shipParticularId;
    if (portId) {
      and.push({
        OR: [
          { opPortId: portId },
          { pier: { portId } },
          { lastPortId: portId },
          { nextPortId: portId },
          { disPortId: portId },
        ],
      });
    }
    if (country) {
      // country is free text on Port; match it across every port a nomination
      // references (operational, last, next, discharge, and the pier's port).
      const countryFilter = { country: { equals: country, mode: 'insensitive' as const } };
      and.push({
        OR: [
          { opPort: countryFilter },
          { lastPort: countryFilter },
          { nextPort: countryFilter },
          { disPort: countryFilter },
          { pier: { port: countryFilter } },
        ],
      });
    }
    if (dateFrom || dateTo) {
      // dateNominated is a timestamptz but the filter is a calendar date, so dateTo has to cover
      // the whole day. `lte: <the date>` resolves to midnight and silently excluded every
      // nomination recorded later on the end date itself.
      const dayAfterDateTo = dateTo ? new Date(dateTo) : null;
      if (dayAfterDateTo) dayAfterDateTo.setDate(dayAfterDateTo.getDate() + 1);

      where.dateNominated = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dayAfterDateTo ? { lt: dayAfterDateTo } : {}),
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
      and.push({ OR: searchClauses });
    }

    if (and.length > 0) where.AND = and;

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
      items: items.map((n) => present(n, now)),
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
    return present(nomination);
  }

  async update(id: string, dto: NominationUpdateInput, userId: string) {
    const existing = await this.prisma.nomination.findUnique({
      where: { id },
      select: { id: true, status: true, kind: true },
    });
    if (!existing) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Nomination is cancelled and cannot be updated.');
    }
    // kind is immutable (omitted from the update schema); re-validate parcels against
    // the nomination's existing kind whenever the parcels are being changed.
    if (dto.parcels) {
      await this.assertParcelsMatchKind(this.prisma, existing.kind, dto.parcels);
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
      return present(updated);
    } catch (err: unknown) {
      if (this.isFkViolation(err)) {
        throw new BadRequestException('Invalid foreign key reference.');
      }
      throw err;
    }
  }

  // Status is derived automatically (see deriveNominationStatus); the only manual
  // transition a user can make is cancellation, which persists CANCELLED.
  async transition(id: string, dto: NominationStatusTransition, userId: string) {
    const existing = await this.prisma.nomination.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!existing) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }

    const { toStatus, reason } = dto;

    if (toStatus !== 'CANCELLED') {
      throw new BadRequestException(
        'Nomination status is derived automatically; the only manual transition is CANCELLED.',
      );
    }

    // fromStatus is the derived current status (NOMINATED / IN_PORT / FULL_AWAY).
    const fromStatus = present(existing).status;

    if (!isValidTransition(fromStatus, toStatus)) {
      throw new BadRequestException({
        message: 'Invalid transition',
        from: fromStatus,
        to: toStatus,
      });
    }

    if (!reason) {
      throw new BadRequestException('reason is required when cancelling a nomination.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.nomination.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: DETAIL_INCLUDE,
      });
      await tx.nominationStatusHistory.create({
        data: {
          nominationId: id,
          fromStatus,
          toStatus,
          changedById: userId,
          reason,
        },
      });

      this.logger.log({
        event: 'nomination.transition',
        nominationId: id,
        correlative: existing.correlative,
        fromStatus,
        toStatus,
        userId,
        reason,
      });
      return present(updated);
    });
  }

  delete(): never {
    throw new MethodNotAllowedException(
      'Nominations cannot be deleted. Use POST /:id/transition with toStatus=CANCELLED.',
    );
  }

  // ---------------------------------------------------------------------------
  // NominationClient CRUD
  // ---------------------------------------------------------------------------

  async listClients(nominationId: string) {
    await this.assertNominationExists(nominationId);
    return this.prisma.nominationClient.findMany({
      where: { nominationId },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async addClient(nominationId: string, dto: NominationClientCreate) {
    await this.assertNominationExists(nominationId);
    return this.prisma.nominationClient.create({
      data: { ...dto, nominationId },
    });
  }

  async updateClient(nominationId: string, clientId: string, dto: NominationClientUpdate) {
    await this.assertClientExists(nominationId, clientId);
    return this.prisma.nominationClient.update({
      where: { id: clientId },
      data: dto,
    });
  }

  async removeClient(nominationId: string, clientId: string) {
    await this.assertClientExists(nominationId, clientId);
    await this.prisma.nominationClient.delete({ where: { id: clientId } });
    this.logger.log({ event: 'nomination.client.removed', nominationId, clientId });
  }

  // ---------------------------------------------------------------------------
  // Sale CRUD — services sold against a nomination (Sales modal)
  // ---------------------------------------------------------------------------

  async listSales(nominationId: string) {
    await this.assertNominationExists(nominationId);
    return this.prisma.sale.findMany({
      where: { nominationId },
      orderBy: { startAt: 'asc' },
      include: SALE_INCLUDE,
    });
  }

  async addSale(nominationId: string, dto: SaleCreate) {
    await this.assertNominationExists(nominationId);
    try {
      return await this.prisma.sale.create({
        data: { ...dto, nominationId },
        include: SALE_INCLUDE,
      });
    } catch (err: unknown) {
      this.rethrowSaleFkViolation(err);
      throw err;
    }
  }

  async updateSale(nominationId: string, saleId: string, dto: SaleUpdate) {
    const current = await this.assertSaleExists(nominationId, saleId);

    // SaleUpdateSchema can only compare startAt against endAt when the client
    // sends both. A PATCH touching one of them alone is checked against the
    // stored value here, so an edit can never leave the row ending before it
    // started.
    const startAt = dto.startAt ?? current.startAt;
    const endAt = dto.endAt === undefined ? current.endAt : dto.endAt;
    if (startAt != null && endAt != null && startAt > endAt) {
      throw new BadRequestException('End time must be on or after start time.');
    }

    try {
      return await this.prisma.sale.update({
        where: { id: saleId },
        data: dto,
        include: SALE_INCLUDE,
      });
    } catch (err: unknown) {
      this.rethrowSaleFkViolation(err);
      throw err;
    }
  }

  async removeSale(nominationId: string, saleId: string) {
    await this.assertSaleExists(nominationId, saleId);
    await this.prisma.sale.delete({ where: { id: saleId } });
    this.logger.log({ event: 'nomination.sale.removed', nominationId, saleId });
  }

  // ---------------------------------------------------------------------------
  // Messages — unified dispatch log across EmailDispatch (PEDR) and ShDocumentDispatch
  // ---------------------------------------------------------------------------

  async getNominationMessages(nominationId: string) {
    await this.assertNominationExists(nominationId);

    // Query email_dispatches via pedr -> nominationId
    const pedrDispatches = await this.prisma.emailDispatch.findMany({
      where: { pedr: { nominationId } },
      include: { sentBy: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Query sh_document_dispatches via shDocument -> nominationId
    const shDispatches = await this.prisma.shDocumentDispatch.findMany({
      where: { shDocument: { nominationId } },
      include: {
        sentBy: { select: { id: true, email: true } },
        shDocument: { select: { type: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    type MessageItem = {
      id: string;
      source: 'PEDR_DISPATCH' | 'SH_DISPATCH';
      type: string;
      subject: string;
      toAddresses: string[];
      ccAddresses: string[];
      sentAt: string | null;
      status: 'SENT' | 'FAILED' | 'PENDING';
      error: string | null;
      createdAt: string;
      sentBy: { id: string; email: string };
      bodyHtml: string | null;
    };

    const pedrItems: MessageItem[] = pedrDispatches.map((d) => ({
      id: d.id,
      source: 'PEDR_DISPATCH',
      type: d.subDocType,
      subject: d.subject,
      toAddresses: d.toAddresses,
      ccAddresses: d.ccAddresses,
      sentAt: d.sentAt ? d.sentAt.toISOString() : null,
      status: d.sentAt ? 'SENT' : d.error ? 'FAILED' : 'PENDING',
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      sentBy: d.sentBy,
      bodyHtml: d.bodyHtml ?? null,
    }));

    const shItems: MessageItem[] = shDispatches.map((d) => ({
      id: d.id,
      source: 'SH_DISPATCH',
      type: d.shDocument.type,
      subject: d.subject,
      toAddresses: d.toAddresses,
      ccAddresses: d.ccAddresses,
      sentAt: d.sentAt ? d.sentAt.toISOString() : null,
      status: d.sentAt ? 'SENT' : d.error ? 'FAILED' : 'PENDING',
      error: d.error,
      createdAt: d.createdAt.toISOString(),
      sentBy: d.sentBy,
      bodyHtml: d.bodyHtml ?? null,
    }));

    const items = [...pedrItems, ...shItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { items };
  }

  // ---------------------------------------------------------------------------
  // Compose — build pre-filled compose data for action modals
  // ---------------------------------------------------------------------------

  async getComposeData(
    nominationId: string,
    actionType: string,
    agentEmail: string,
  ): Promise<ComposeData> {
    const [nomination, agent] = await Promise.all([
      this.prisma.nomination.findUnique({
        where: { id: nominationId },
        select: {
          emailTo: true,
          emailCc: true,
          emailBcc: true,
          subject: true,
          referenceNo: true,
          parcels: true,
          dateNominated: true,
          voyageNumber: true,
          correlative: true,
          kind: true,
          layDaysFirst: true,
          layDaysLast: true,
          etaDate: true,
          nominationType: true,
          // Addressee of the pre-arrival letter ("Dear Master …").
          master: true,
          // Supplies the body's "TO:" line — see resolveNominatingParty below.
          // `shipper` is joined for ETA_TERMINAL, which is addressed to the
          // shipper and the terminal rather than to the client list.
          nominationClients: {
            select: {
              type: true,
              name: true,
              shipper: { select: { name: true, emails: true } },
            },
            orderBy: { sortOrder: 'asc' },
          },
          nominatedBy: { select: { displayName: true, email: true } },
          shipParticular: { select: { name: true } },
          // `emails` is the terminal's own distribution list.
          opPort: { select: { name: true, emails: true } },
          lastPort: { select: { name: true } },
          nextPort: { select: { name: true } },
          branch: {
            select: {
              name: true,
              code: true,
              emails: true,
              address: true,
              phone: true,
              fax: true,
              mobile24h: true,
              coverage: true,
              contactName: true,
              contactTitle: true,
              contactMobile: true,
              contactEmails: true,
              centralEmails: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { email: agentEmail },
        select: { displayName: true, jobTitle: true, phone: true, mobile: true, fax: true },
      }),
    ]);

    if (!nomination) throw new NotFoundException(`Nomination ${nominationId} not found.`);

    const relPath =
      COMPOSE_TEMPLATE_PATHS[actionType.toUpperCase()] ?? `${actionType.toLowerCase()}.hbs`;

    // ---------------------------------------------------------------------------
    // Template variables
    // ---------------------------------------------------------------------------
    // Every date on a notice reads "Jul-18th, 2026" — the form the agency's
    // recipients are used to. It replaced DD/MM/YYYY, which was ambiguous to
    // read across the agency's US and European counterparties.
    const fmtDate = (d: Date | null) => formatNoticeDate(d);

    const fmtTime = (d: Date | null) =>
      d
        ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : '';

    const parcels = Array.isArray(nomination.parcels) ? nomination.parcels : [];
    const firstParcel = (parcels as Array<Record<string, unknown>>)[0] ?? {};
    const branch = nomination.branch;

    // The shipper named on the CLIENT LIST. Its name heads the "CC:" line of the
    // terminal notice and its addresses join the terminal's on the To line.
    const shipper = NominationsService.resolveShipper(nomination.nominationClients);

    const snRef = formatSnOt(nomination.correlative, nomination.dateNominated, nomination.kind);
    const vesselName = nomination.shipParticular?.name ?? '';
    const voyageNo = nomination.voyageNumber ?? '';
    const terminalName = nomination.opPort?.name ?? '';
    const branchCode = branch?.code ?? '';
    const yy = String(nomination.dateNominated.getFullYear()).slice(-2);
    const kindPrefix = nomination.kind === 'OT' ? 'OT' : 'SN';
    // "SN1522/24/JSE" — the form the agency writes on notices. Distinct from
    // formatSnOt's internal "SN-24/1522"; both refer to the same nomination.
    const snOtRef = `${kindPrefix}${nomination.correlative}/${yy}/${branchCode}`;
    const refNo = nomination.referenceNo?.trim() ?? '';
    // Default matches the nomination form's auto-generated subject. If the user
    // edited the nomination's subject, that edit is preserved and reused here so
    // every email for this nomination shares the same reference line.
    const refNoPrefix = refNo ? `${refNo} - ` : '';
    const defaultRefLine = `${refNoPrefix}${vesselName} - Calling to ${terminalName} ${snOtRef}`;
    const refLine = nomination.subject?.trim() || defaultRefLine;

    // Load ETA record for ETA action types
    const isEtaType = ['ETA_REQUEST', 'ETA_TERMINAL', 'ETA_REPLY'].includes(
      actionType.toUpperCase(),
    );
    let etaRecord: {
      msgEta: Date | null;
      etaNotify: Date | null;
      etaNotifyOn: boolean;
      etpob: Date | null;
      etpobOn: boolean;
      etb: Date | null;
      etbOn: boolean;
      refMessage: string | null;
    } | null = null;

    if (isEtaType) {
      const pedr = await this.prisma.pedr.findUnique({
        where: { nominationId },
        select: { etaRecord: true },
      });
      etaRecord = pedr?.etaRecord ?? null;
    }

    const templateVars = {
      vessel_name: vesselName,
      voyage_no: voyageNo,
      terminal_name: terminalName,
      oper_port: terminalName,
      sn_ref: snRef,
      sn_ot_ref: snOtRef,
      ref_line: refLine,
      // Charter-party reference the agency types into "Reference N°".
      ref_no: refNo,
      // Both ends spelled out — "Jul. 06th, 2026 - Jul. 10th, 2026". A laycan is
      // what a demurrage claim is argued from, so it is written in full.
      laycan: formatNoticeDateRange(nomination.layDaysFirst, nomination.layDaysLast),
      cargo_quantity: formatCargoQuantity(firstParcel['quantity']),
      cargo_unit: String(firstParcel['unit'] ?? ''),
      cargo_grade: String(firstParcel['product'] ?? ''),
      lay_days: formatNoticeDateRange(nomination.layDaysFirst, nomination.layDaysLast),
      // Collapsed laycan, e.g. "Jul. 06th-10th, 2026". Kept distinct from
      // lay_days, which spells both ends out, because the templates using it
      // were written around the shorter form.
      lay_days_long: formatLaydayRange(nomination.layDaysFirst, nomination.layDaysLast),
      operation: String(firstParcel['operation'] ?? firstParcel['product'] ?? ''),
      // Cargo update — multi-parcel loop data. Figures are grouped and carry two
      // decimals ("1,950,210.00"); a transfer rate is quoted per hour in the
      // parcel's own unit, so wheat reads MT/Hr and crude Bbls/Hr.
      parcels: (parcels as Array<Record<string, unknown>>).map((p) => ({
        cargo_grade: String(p['product'] ?? ''),
        operation: String(p['operation'] ?? ''),
        quantity: formatCargoFigure(p['quantity'] ?? 0),
        unit: String(p['unit'] ?? ''),
        qty_on_board: formatCargoFigure(p['qtyOnBoard'] ?? 0),
        // `||`, not `??` — a unit cell left on its inherited default is stored
        // as an empty string, which `??` would print as no unit at all.
        qty_on_board_unit: String(p['qtyOnBoardUnit'] || p['unit'] || ''),
        qty_to_go: formatCargoFigure(p['qtyToGo'] ?? 0),
        qty_to_go_unit: String(p['qtyToGoUnit'] || p['unit'] || ''),
        loading_rate: formatCargoFigure(p['loadingRate'] ?? 0),
        loading_rate_unit: resolveTransferRateUnit(
          p['loadingRateUnit'] as string | null | undefined,
          (p['qtyOnBoardUnit'] || p['unit']) as string | null | undefined,
        ),
        t_etc: formatEtcStamp(p['etcDate'], p['etcTime']),
      })),
      last_port: nomination.lastPort?.name ?? '',
      next_port: nomination.nextPort?.name ?? '',
      flag: '',
      master_name: nomination.master?.trim() ?? '',
      master_rank: 'MASTER',
      master_msg_date: fmtDate(etaRecord?.msgEta ?? null),
      nomination_date: fmtDate(nomination.dateNominated),
      eta_date: fmtDate(etaRecord?.etaNotify ?? nomination.etaDate ?? null),
      eta_time: fmtTime(etaRecord?.etaNotify ?? null),
      distance_to_go: '',
      etpobOn: etaRecord?.etpobOn ?? false,
      etpob_date: fmtDate(etaRecord?.etpob ?? null),
      etpob_time: fmtTime(etaRecord?.etpob ?? null),
      etbOn: etaRecord?.etbOn ?? false,
      etb_date: fmtDate(etaRecord?.etb ?? null),
      etb_time: fmtTime(etaRecord?.etb ?? null),
      agent_name: agent?.displayName ?? agentEmail.split('@')[0] ?? agentEmail,
      agent_title: agent?.jobTitle ?? '',
      agent_email: branch?.emails.length ? branch.emails.join('; ') : agentEmail,
      agent_mobile: agent?.mobile ?? branch?.mobile24h ?? '',
      // Signature phone line — the agent's own numbers when set, else the branch
      // 24h line (which is free text and may already hold several numbers).
      agent_phones:
        [agent?.mobile, agent?.phone].filter((p) => p?.trim()).join(' / ') ||
        branch?.mobile24h ||
        '',
      // "CC:" line of the terminal notice — the shipper the cargo moves for.
      shipper_name: shipper.name,
      // "TO:" line — who nominated us.
      nominating_party: NominationsService.resolveNominatingParty(
        nomination.nominationClients,
        nomination.nominatedBy,
      ),
      // Named on the pre-arrival letter's "Cc:" header and in "on behalf of
      // Charterers …". Both fall back to the nominating party rather than
      // rendering an empty phrase mid-sentence.
      operator_name:
        NominationsService.resolveClientByType(
          nomination.nominationClients,
          NominationsService.OPERATOR_TYPES,
        ) || NominationsService.resolveNominatingParty(nomination.nominationClients, null),
      charterer_name:
        NominationsService.resolveClientByType(
          nomination.nominationClients,
          NominationsService.CHARTERER_TYPES,
        ) || NominationsService.resolveNominatingParty(nomination.nominationClients, null),
      // Header recipient lines. Templates referenced these long before anything
      // supplied them, so they rendered as bare "To:" / "Cc:" labels.
      to_recipients: nomination.emailTo.join('; '),
      cc_recipients: nomination.emailCc.join('; '),
      company_website: 'www.navieramar.com',
      current_year: String(new Date().getFullYear()),
      branch_office: branch?.name ?? '',
      branch_coverage: branch?.coverage ?? '',
      branch_address: branch?.address ?? '',
      branch_phone: agent?.phone ?? branch?.phone ?? '',
      branch_fax: agent?.fax ?? branch?.fax ?? '',
      contact_person: branch?.contactName ?? '',
      contact_title: branch?.contactTitle ?? '',
      contact_mobile: branch?.contactMobile ?? '',
      contact_email: branch?.contactEmails?.join('; ') ?? '',
      central_emails: branch?.centralEmails?.join('; ') ?? '',
      // Cargo update date/time — rendered at time of compose
      update_date: fmtDate(new Date()),
      update_time: fmtTime(new Date()),
      t_etd: '',
      t_etd_berth: '',
      // SOF-specific — populated below when actionType === 'SOF'.
      // statement_of_facts_log is also filled for CARGO_UPDATE, which carries the
      // same event log beneath its figures.
      statement_of_facts_log: '',
      bl_figures_section: '',
      arrival_conditions_section: '',
      sailed_conditions_section: '',
      vessel_cargo_figures_section: '',
      slop_bunkers_section: '',
      letters_section: '',
      remarks_section: '',
    };

    // ---------------------------------------------------------------------------
    // Cargo Update — enrich the Operation line with every parcel's
    // "<operation> <quantity> <unit> of <product>" description. Mirrors the SOF
    // operation format below, but lists all parcels (joined with "; ") since a
    // cargo update is inherently multi-parcel.
    // ---------------------------------------------------------------------------
    if (actionType.toUpperCase() === 'CARGO_UPDATE') {
      // A cargo update carries the same event log the SOF does — the recipient
      // reads the figures against the history that produced them.
      templateVars.statement_of_facts_log = await this.buildSofEventLog(nominationId);

      const parcelDescriptions = (parcels as Array<Record<string, unknown>>)
        .map((p) =>
          [
            p['operation'],
            // Grouped with two decimals, matching the figures in the update
            // block below it — the same tonnage in two formats on one notice
            // invites a reader to think they are two different numbers.
            p['quantity'] ? `${formatCargoFigure(p['quantity'])} ${p['unit'] ?? ''}`.trim() : '',
            p['product'] ? String(p['product']) : '',
          ]
            .filter(Boolean)
            .join(' '),
        )
        .filter((desc) => desc.length > 0);
      if (parcelDescriptions.length > 0) {
        templateVars.operation = parcelDescriptions.join('; ');
      }
    }

    // ---------------------------------------------------------------------------
    // SOF — fetch timesheet and build log / BL-figures / letters / remarks vars
    // ---------------------------------------------------------------------------
    if (actionType.toUpperCase() === 'SOF') {
      const sof = await this.prisma.sofTimesheet.findUnique({
        where: { nominationId },
        include: {
          entries: {
            orderBy: { order: 'asc' },
            include: { activity: { select: { id: true, name: true } } },
          },
        },
      });

      templateVars.statement_of_facts_log = NominationsService.formatSofEventLog(
        sof?.entries ?? [],
      );

      // Arrival / Sailed conditions — bunkers remaining on board plus draft, as
      // recorded in the Bunkers & Draft dialog.
      templateVars.arrival_conditions_section = NominationsService.formatVesselConditions(
        sof?.bunkersData,
        sof?.draftData,
        'arrival',
      );
      templateVars.sailed_conditions_section = NominationsService.formatVesselConditions(
        sof?.bunkersData,
        sof?.draftData,
        'sailing',
      );

      // Vessel Cargo Figures — the ship's own loaded figures, stated alongside
      // the bills of lading so the two can be compared.
      templateVars.vessel_cargo_figures_section = NominationsService.formatVesselCargoFigures(
        sof?.shipFiguresData,
      );

      // BL Figures section (one block per cargo column)
      type DynRows = Record<string, string[]>;
      const blData = sof?.blFiguresData as { columns?: string[]; rows?: DynRows } | null;
      const blCols = blData?.columns ?? [];
      const blRows = blData?.rows ?? {};
      const v = (key: string, col: number) => blRows[key]?.[col] ?? '';
      /** Same, for the figures — grouped as the bill states them. */
      const n = (key: string, col: number) => formatQuantity(blRows[key]?.[col] ?? '');
      // One block per cargo column, numbered "Bill #1", "Bill #2" … as the
      // agency's own statements number them.
      const RULE = '--------------------------------------------------';
      const blBlocks = blCols.map((colName, ci) => {
        const lines: string[] = [
          RULE,
          `${colName ? colName + ' - ' : ''}Bill #${ci + 1} Of Lading Figures:`,
          RULE,
          `                     Gross           Net`,
          `Bbls at 60 F ..: ${n('grossBbls', ci).padStart(12)}  ${n('netBbls', ci).padStart(12)}`,
          `M/Tons at 60 F.: ${n('grossMt', ci).padStart(12)}  ${n('netMt', ci).padStart(12)}`,
          `L/Tons at 60 F.: ${n('grossLt', ci).padStart(12)}  ${n('netLt', ci).padStart(12)}`,
          ``,
          `Shipper  : ${v('shipper', ci)}`,
          `Consignee: ${v('consignee', ci)}`,
          `Disport  : ${v('destination', ci)}`,
          `SCACCODE : ${v('scacCode', ci)}`,
          `B/L Date : ${v('date', ci)}`,
          `B/L No   : ${v('blNumber', ci)}`,
          `Remark   : ${v('remark', ci)}`,
          `API      : ${n('api', ci)}`,
          `Temp     : ${n('temp', ci)}`,
        ];
        return lines.join('\n');
      });
      templateVars.bl_figures_section = blBlocks.join('\n');

      // Slop discharged / bunkers received
      type SlopRow = { event?: string; date?: string; time?: string };
      const slopData = sof?.slopDischargedData as { rows?: SlopRow[] } | null;
      const slopLines = (slopData?.rows ?? [])
        .filter((r) => r.date || r.time)
        .map((r) => `${r.event ?? ''}: ${r.date ?? ''} ${r.time ?? ''}`.trim());

      type BunkerRow = { event?: string; values?: string[]; water?: string };
      const bunkersData = sof?.bunkersReceivedData as {
        columns?: string[];
        rows?: BunkerRow[];
      } | null;
      const bunkerCols = bunkersData?.columns ?? [];
      const bunkerLines = (bunkersData?.rows ?? [])
        .filter((r) => (r.values ?? []).some((v) => v) || r.water)
        .map((r) => {
          const grades = bunkerCols
            .map((col, i) => (r.values?.[i] ? `${col}: ${r.values[i]}` : ''))
            .filter(Boolean)
            .join('  ');
          const water = r.water ? `Water: ${r.water}` : '';
          return [r.event ?? '', grades, water].filter(Boolean).join('  ');
        });

      const slopBunkersBlocks: string[] = [];
      if (slopLines.length > 0) {
        slopBunkersBlocks.push(['Slop Discharged:', ...slopLines].join('\n'));
      }
      if (bunkerLines.length > 0) {
        slopBunkersBlocks.push(['Bunkers Received:', ...bunkerLines].join('\n'));
      }
      templateVars.slop_bunkers_section = slopBunkersBlocks.join('\n\n');

      // Letters of protest — a zero-padded numbered list of the protests raised,
      // which is how they are read off the statement. The from/to pair is not
      // restated per line: the section heading already says who protested to whom.
      type LetterItem = { from?: string; to?: string; comment?: string };
      const lettersData = sof?.lettersData as { items?: LetterItem[] } | null;
      templateVars.letters_section = (lettersData?.items ?? [])
        .map((l, i) => {
          const subject = (l.comment ?? '').trim() || (l.to ?? '').trim();
          return `${String(i + 1).padStart(2, '0')}. ${subject}`;
        })
        .join('\n');

      // Remarks
      type RemarkItem = {
        remark?: string;
        beginDate?: string;
        beginTime?: string;
        endDate?: string;
        endTime?: string;
        comment?: string;
      };
      // Remarks are the delay periods a demurrage claim is built from, so each
      // reads as a span: "Fm <start> To <end> <reason>". A remark without both
      // ends still prints, rather than being dropped for being incomplete.
      const remarksData = sof?.remarksData as { items?: RemarkItem[] } | null;
      templateVars.remarks_section = (remarksData?.items ?? [])
        .map((r) => {
          const stamp = (date?: string, time?: string) =>
            [date?.trim(), time?.trim()].filter(Boolean).join(' ');
          const from = stamp(r.beginDate, r.beginTime);
          const to = stamp(r.endDate, r.endTime);
          const span = [from ? `Fm ${from}` : '', to ? `To ${to}` : ''].filter(Boolean).join(' ');
          const reason = (r.remark ?? '').trim();
          return [span, reason, (r.comment ?? '').trim()].filter(Boolean).join(' ');
        })
        .filter((line) => line !== '')
        .join('\n');

      // Operation string
      const fp = (nomination.parcels as Array<Record<string, unknown>>)[0] ?? {};
      if (fp['operation'] || fp['product']) {
        templateVars.operation = [
          fp['operation'],
          fp['quantity'] ? `${formatCargoFigure(fp['quantity'])} ${fp['unit'] ?? ''}`.trim() : '',
          fp['product'] ? String(fp['product']) : '',
        ]
          .filter(Boolean)
          .join(' ');
      }

      // Lay days deliberately keep the shared "Jul. 06th, 2026 - Jul. 10th, 2026"
      // form. The SOF used to override it with "28 May, 2026", which is why this
      // block no longer sets lay_days at all.
    }

    // ---------------------------------------------------------------------------
    // Render — via EmailTemplateService, which registers the {{> signature}}
    // partial. Compiling the source here instead throws on the missing partial.
    // ---------------------------------------------------------------------------
    const rendered = await this.emailTemplates.render(relPath, templateVars);

    const subject = rendered.subject ?? nomination.subject ?? nomination.shipParticular?.name ?? '';

    // ---------------------------------------------------------------------------
    // Recipients
    //
    // Every notice defaults to the nomination's own distribution list, which is
    // the client's. Two are addressed elsewhere: ETA_TERMINAL and the NOR both
    // go to the shipper and to the terminal the vessel is scheduled at, so their
    // To line is built from the operational port's address list plus the
    // shipper's. Cc is untouched — the agency's internal copies apply to these
    // notices too.
    //
    // If neither is registered there is nothing to address it to, so it falls
    // back to the nomination's list rather than opening with an empty To that
    // reads as a bug. The agent can still edit the line before sending.
    // ---------------------------------------------------------------------------
    let toAddresses = nomination.emailTo;
    let ccAddresses = nomination.emailCc;
    let bccAddresses = nomination.emailBcc;

    if (TERMINAL_ADDRESSED_ACTIONS.has(actionType.toUpperCase())) {
      const terminalAndShipper = dedupeEmails([
        ...(nomination.opPort?.emails ?? []),
        ...shipper.emails,
      ]);
      if (terminalAndShipper.length > 0) toAddresses = terminalAndShipper;

      // With the notice addressed outside the client's list, the agency's own
      // copies have to be added deliberately: the branch handling the call is
      // copied, and head office is blind-copied so the terminal and shipper do
      // not see the agency's internal oversight list. Both are appended to
      // whatever the nomination already carries rather than replacing it.
      const branchEmails = branch?.emails ?? [];
      const centralEmails = branch?.centralEmails ?? [];
      if (branchEmails.length > 0) ccAddresses = dedupeEmails([...ccAddresses, ...branchEmails]);
      if (centralEmails.length > 0)
        bccAddresses = dedupeEmails([...bccAddresses, ...centralEmails]);
    }

    return {
      subject,
      toAddresses,
      ccAddresses,
      bccAddresses,
      // Plain text only — the compose editor shows and edits the letter itself.
      // The mail-client wrapper is added at send time.
      bodyText: rendered.bodyText,
    };
  }

  // ---------------------------------------------------------------------------
  // Parcels — persist cargo-update figures back to the nomination
  // ---------------------------------------------------------------------------

  async updateParcels(nominationId: string, parcels: unknown[]): Promise<void> {
    await this.prisma.nomination.update({
      where: { id: nominationId },
      data: { parcels: parcels as import('@prisma/client').Prisma.JsonArray },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * CLIENT LIST rows whose `type` names the party operating the vessel, most
   * specific first. `type` is free text in the DB, so matching is
   * case-insensitive on the trimmed value.
   */
  private static readonly OPERATOR_TYPES = [
    'commercial operator',
    'technical operator',
    'disponent owner',
    'head owner',
  ];

  /** CLIENT LIST rows whose `type` names the chartering party. */
  private static readonly CHARTERER_TYPES = ['charterer', 'time charter'];

  /**
   * Bunker grades as the statement groups them. The dialog records eight grades
   * but a statement names the family, so several grades can land on one label —
   * each recorded grade still gets its own line rather than being summed, since
   * inventing a total from two figures the agent entered separately would put a
   * number on the document that nobody wrote.
   */
  /**
   * The bunker grades a statement reports, in print order.
   *
   * Only the three grades the Bunkers dialog records — the other five the
   * schema tolerates (HSFO, LSFO, VLSFO, MDO, LSMGO) all collapsed onto the
   * same two labels, so a timesheet carrying more than one of them would print
   * "Fuel Oil" twice with no way to tell the lines apart.
   */
  private static readonly BUNKER_LABELS: Record<string, string> = {
    IFO: 'Fuel Oil',
    MGO: 'Diesel Oil',
    FW: 'Fresh Water',
  };

  /** The SOF event log, one "<date> <time> <activity>" line per entry. */
  private static formatSofEventLog(
    entries: { occurredAt: Date; comment: string | null; activity: { name: string } | null }[],
  ): string {
    const fmtTime = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

    // A "." activity is a continuation marker, so its comment stays inline on
    // the same row instead of wrapping to an indented line.
    return entries
      .map((e) => {
        const d = new Date(e.occurredAt);
        const activityName = e.activity?.name ?? '';
        const line = `${formatNoticeDate(d)} ${fmtTime(d)} ${activityName}`;
        if (!e.comment) return line;
        return activityName === '.' ? `${line} ${e.comment}` : `${line}\n     ${e.comment}`;
      })
      .join('\n');
  }

  /** Loads the event log for a nomination, for notices that carry it. */
  private async buildSofEventLog(nominationId: string): Promise<string> {
    const sof = await this.prisma.sofTimesheet.findUnique({
      where: { nominationId },
      select: {
        entries: {
          orderBy: { order: 'asc' },
          select: {
            occurredAt: true,
            comment: true,
            activity: { select: { name: true } },
          },
        },
      },
    });
    return NominationsService.formatSofEventLog(sof?.entries ?? []);
  }

  /**
   * Bunkers remaining and draft at one end of the call, e.g.
   *
   *     Fuel Oil   :   4,214.70 MT
   *     Fresh Water:     514.00 MT
   *     Draft: Fwd. 08.00 Mts / Aft. 11.00 Mts
   *
   * Renders empty when nothing was recorded, so the template drops the whole
   * block rather than printing a heading over blank lines.
   */
  private static formatVesselConditions(
    bunkersData: unknown,
    draftData: unknown,
    column: 'arrival' | 'sailing',
  ): string {
    const bunkers = (bunkersData ?? {}) as Record<string, Record<string, string> | undefined>;
    const draft = (draftData ?? {}) as Record<string, Record<string, string> | undefined>;

    const lines = Object.entries(NominationsService.BUNKER_LABELS)
      .map(([grade, label]) => {
        const value = formatQuantity(bunkers[grade]?.[column]);
        return value ? `${label.padEnd(11)}: ${value.padStart(10)} MT` : '';
      })
      .filter(Boolean);

    const fwd = draft['FWD']?.[column]?.trim();
    const aft = draft['AFT']?.[column]?.trim();
    if (fwd || aft) {
      lines.push(`Draft: Fwd. ${fwd || '-'} Mts / Aft. ${aft || '-'} Mts`);
    }

    return lines.join('\n');
  }

  /**
   * The ship's own loaded figures, one block per cargo column:
   *
   *     Merey 16 Crude Oil - Vessel Cargo Figures:
   *     Ship's Loaded Figures Bbls: 1,949,562.000
   *
   * Stated next to the bills of lading precisely so the two can be compared, so
   * a column with no figures at all is skipped rather than printed empty.
   */
  private static formatVesselCargoFigures(shipFiguresData: unknown): string {
    const data = (shipFiguresData ?? {}) as {
      columns?: string[];
      rows?: Record<string, string[]>;
    };
    const columns = data.columns ?? [];
    const rows = data.rows ?? {};
    const RULE = '-----------------------------------------------';

    const blocks = columns
      .map((colName, ci) => {
        const figure = (key: string) => formatQuantity(rows[key]?.[ci]);
        const measures: [string, string][] = [
          ["Ship's Loaded Figures Bbls:", figure('bbls')],
          ["Ship's Loaded Figures M/T:", figure('mtons')],
          ["Ship's Loaded Figures L/T:", figure('ltons')],
        ];
        if (measures.every(([, value]) => value === '')) return '';

        return [
          RULE,
          `${colName ? colName + ' - ' : ''}Vessel Cargo Figures:`,
          RULE,
          ...measures
            .filter(([, value]) => value !== '')
            .map(([label, value]) => `${label.padEnd(27)} ${value.padStart(16)}`),
        ].join('\n');
      })
      .filter(Boolean);

    return blocks.join('\n');
  }

  /**
   * The shipper named on the CLIENT LIST, with its registered addresses.
   *
   * The name comes from the row as typed, so a hand-written shipper still heads
   * the notice's "CC:" line. Addresses come only from the linked master-data
   * record — there is no name matching, because mailing a legally binding notice
   * to a company picked by fuzzy string match is not a risk worth taking. A row
   * typed free-hand therefore contributes a name and no addresses.
   */
  private static resolveShipper(
    clients: { type: string; name: string; shipper?: { name: string; emails: string[] } | null }[],
  ): { name: string; emails: string[] } {
    const row = clients.find(
      (c) => c.type.trim().toLowerCase() === 'shipper' && (c.name.trim() !== '' || c.shipper),
    );
    if (!row) return { name: '', emails: [] };
    return {
      name: row.name.trim() || (row.shipper?.name ?? ''),
      emails: row.shipper?.emails ?? [],
    };
  }

  /** First named CLIENT LIST row matching `priority`, or '' when none match. */
  private static resolveClientByType(
    clients: { type: string; name: string }[],
    priority: readonly string[],
  ): string {
    for (const wanted of priority) {
      const match = clients.find(
        (c) => c.type.trim().toLowerCase() === wanted && c.name.trim() !== '',
      );
      if (match) return match.name.trim();
    }
    return '';
  }

  /**
   * Resolves the party the nomination came from, for the "TO:" line of outgoing
   * emails.
   *
   * The nominating company is only recorded in the client list, so it is read from
   * there in priority order — the charterer nominates in the common case, with the
   * owner/operator rows covering owner's-agent appointments. Those four rows are
   * auto-created blank on every nomination and are frequently left empty, so any
   * blank name is skipped rather than emitted as an empty "TO:".
   *
   * Falls back to `nominatedById` ("Nomination Received by") when no company is
   * recorded. That is an internal user rather than the counterparty, so it is a
   * last resort, not a preference.
   */
  private static resolveNominatingParty(
    clients: { type: string; name: string }[],
    nominatedBy: { displayName: string | null; email: string } | null,
  ): string {
    const PRIORITY = [
      'charterer',
      'disponent owner',
      'head owner',
      'commercial operator',
      'technical operator',
      'time charter',
    ];

    const byType = NominationsService.resolveClientByType(clients, PRIORITY);
    if (byType) return byType;

    // Any other filled row beats falling back to an internal user.
    const anyNamed = clients.find((c) => c.name.trim() !== '');
    if (anyNamed) return anyNamed.name.trim();

    if (nominatedBy) return nominatedBy.displayName?.trim() || nominatedBy.email;

    return '';
  }

  private async assertNominationExists(id: string): Promise<void> {
    const exists = await this.prisma.nomination.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }
  }

  private async assertClientExists(nominationId: string, clientId: string): Promise<void> {
    const exists = await this.prisma.nominationClient.findFirst({
      where: { id: clientId, nominationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Client ${clientId} not found on nomination ${nominationId}.`);
    }
  }

  /** Returns the sale's service window so callers can validate partial updates against it. */
  private async assertSaleExists(
    nominationId: string,
    saleId: string,
  ): Promise<{ startAt: Date; endAt: Date | null }> {
    const existing = await this.prisma.sale.findFirst({
      where: { id: saleId, nominationId },
      select: { startAt: true, endAt: true },
    });
    if (!existing) {
      throw new NotFoundException(`Sale ${saleId} not found on nomination ${nominationId}.`);
    }
    return existing;
  }

  /** A stale/bad client, service, port, driver or user FK should surface as a 400, not a 500. */
  private rethrowSaleFkViolation(err: unknown): void {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new BadRequestException('Unknown client, service, port, driver, or user id.');
    }
  }

  async sendEmail(
    nominationId: string,
    body: SendNominationEmailInput,
    userId: string,
  ): Promise<void> {
    const pedr = await this.prisma.pedr.findUnique({
      where: { nominationId },
      select: { id: true },
    });
    if (!pedr) throw new NotFoundException(`No PEDR found for nomination ${nominationId}.`);

    // Resolve user-uploaded attachments up front (fails fast on bad id / oversize).
    const userAttachments = await this.attachmentsService.resolveForSend(body.attachmentIds ?? []);

    // The agent composes plain text; this is where it becomes the HTML that
    // goes on the wire. The dispatch row stores that same HTML, so the message
    // log shows exactly what the recipient received.
    const bodyHtml = wrapPlainTextEmailBody(body.bodyText);

    const dispatch = await this.prisma.emailDispatch.create({
      data: {
        pedrId: pedr.id,
        subDocType: body.subDocType,
        toAddresses: body.toAddresses,
        ccAddresses: body.ccAddresses,
        bccAddresses: body.bccAddresses,
        subject: body.subject,
        bodyHtml,
        sentById: userId,
      },
    });

    await this.emailService.send({
      to: body.toAddresses,
      cc: body.ccAddresses,
      bcc: body.bccAddresses,
      subject: body.subject,
      html: bodyHtml,
      attachments: userAttachments.length ? userAttachments : undefined,
    });

    await this.prisma.emailDispatch.update({
      where: { id: dispatch.id },
      data: { sentAt: new Date() },
    });
    await this.attachmentsService.linkToEmailDispatch(body.attachmentIds ?? [], dispatch.id);
  }

  // ---------------------------------------------------------------------------
  // ETA record — GET and upsert for "Answer ETA" modal
  // ---------------------------------------------------------------------------

  async getEtaRecord(nominationId: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { nominationId },
      select: { id: true, etaRecord: true },
    });
    if (!pedr) throw new NotFoundException(`No PEDR found for nomination ${nominationId}.`);

    if (!pedr.etaRecord) {
      return {
        id: null,
        pedrId: pedr.id,
        msgEta: null,
        etaNotify: null,
        etaNotifyOn: false,
        etpob: null,
        etpobOn: false,
        etb: null,
        etbOn: false,
        refMessage: null,
        updatedAt: null,
      };
    }

    const r = pedr.etaRecord;
    return {
      id: r.id,
      pedrId: r.pedrId,
      msgEta: r.msgEta?.toISOString() ?? null,
      etaNotify: r.etaNotify?.toISOString() ?? null,
      etaNotifyOn: r.etaNotifyOn,
      etpob: r.etpob?.toISOString() ?? null,
      etpobOn: r.etpobOn,
      etb: r.etb?.toISOString() ?? null,
      etbOn: r.etbOn,
      refMessage: r.refMessage,
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  async saveEtaRecord(nominationId: string, body: EtaRecordSaveInput) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { nominationId },
      select: { id: true },
    });
    if (!pedr) throw new NotFoundException(`No PEDR found for nomination ${nominationId}.`);

    const data = {
      msgEta: body.msgEta ? new Date(body.msgEta) : null,
      etaNotify: body.etaNotify ? new Date(body.etaNotify) : null,
      etaNotifyOn: body.etaNotifyOn ?? false,
      etpob: body.etpob ? new Date(body.etpob) : null,
      etpobOn: body.etpobOn ?? false,
      etb: body.etb ? new Date(body.etb) : null,
      etbOn: body.etbOn ?? false,
      refMessage: body.refMessage ?? null,
    };

    const record = await this.prisma.pedrEtaRecord.upsert({
      where: { pedrId: pedr.id },
      create: { pedrId: pedr.id, ...data },
      update: data,
    });

    return {
      id: record.id,
      pedrId: record.pedrId,
      msgEta: record.msgEta?.toISOString() ?? null,
      etaNotify: record.etaNotify?.toISOString() ?? null,
      etaNotifyOn: record.etaNotifyOn,
      etpob: record.etpob?.toISOString() ?? null,
      etpobOn: record.etpobOn,
      etb: record.etb?.toISOString() ?? null,
      etbOn: record.etbOn,
      refMessage: record.refMessage,
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // SOF Timesheet
  // ---------------------------------------------------------------------------

  async getSofTimesheet(nominationId: string) {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: {
        id: true,
        lastPortId: true,
        nextPortId: true,
        pierId: true,
        master: true,
        sofTimesheet: {
          include: {
            lastPort: { select: { id: true, name: true } },
            nextPort: { select: { id: true, name: true } },
            pier: { select: { id: true, name: true } },
            entries: {
              orderBy: { order: 'asc' },
              include: { activity: { select: { id: true, name: true } } },
            },
          },
        },
      },
    });

    if (!nomination) {
      throw new NotFoundException(`Nomination ${nominationId} not found.`);
    }

    if (nomination.sofTimesheet) {
      return nomination.sofTimesheet;
    }

    // No timesheet saved yet — return prefilled default from nomination fields
    return {
      id: undefined,
      nominationId,
      lastPortId: nomination.lastPortId ?? null,
      lastPort: null,
      nextPortId: nomination.nextPortId ?? null,
      nextPort: null,
      pierId: nomination.pierId ?? null,
      pier: null,
      captain: nomination.master ?? null,
      mobileOnBoard: null,
      entries: [],
    };
  }

  async saveSofTimesheet(nominationId: string, dto: SofTimesheetInput) {
    await this.assertNominationExists(nominationId);

    return this.prisma.$transaction(async (tx) => {
      const timesheet = await tx.sofTimesheet.upsert({
        where: { nominationId },
        create: {
          nominationId,
          lastPortId: dto.lastPortId ?? null,
          nextPortId: dto.nextPortId ?? null,
          pierId: dto.pierId ?? null,
          captain: dto.captain ?? null,
          mobileOnBoard: dto.mobileOnBoard ?? null,
          ...(dto.bunkersData != null && { bunkersData: dto.bunkersData }),
          ...(dto.draftData != null && { draftData: dto.draftData }),
          ...(dto.sofParcelsData != null && { sofParcelsData: dto.sofParcelsData }),
          ...(dto.blFiguresData != null && { blFiguresData: dto.blFiguresData }),
          ...(dto.shipFiguresData != null && { shipFiguresData: dto.shipFiguresData }),
          ...(dto.lettersData != null && { lettersData: dto.lettersData }),
          ...(dto.remarksData != null && { remarksData: dto.remarksData }),
          ...(dto.slopDischargedData != null && {
            slopDischargedData: dto.slopDischargedData,
          }),
          ...(dto.bunkersReceivedData != null && {
            bunkersReceivedData: dto.bunkersReceivedData,
          }),
        },
        update: {
          lastPortId: dto.lastPortId ?? null,
          nextPortId: dto.nextPortId ?? null,
          pierId: dto.pierId ?? null,
          captain: dto.captain ?? null,
          mobileOnBoard: dto.mobileOnBoard ?? null,
          ...(dto.bunkersData != null && { bunkersData: dto.bunkersData }),
          ...(dto.draftData != null && { draftData: dto.draftData }),
          ...(dto.sofParcelsData != null && { sofParcelsData: dto.sofParcelsData }),
          ...(dto.blFiguresData != null && { blFiguresData: dto.blFiguresData }),
          ...(dto.shipFiguresData != null && { shipFiguresData: dto.shipFiguresData }),
          ...(dto.lettersData != null && { lettersData: dto.lettersData }),
          ...(dto.remarksData != null && { remarksData: dto.remarksData }),
          ...(dto.slopDischargedData != null && {
            slopDischargedData: dto.slopDischargedData,
          }),
          ...(dto.bunkersReceivedData != null && {
            bunkersReceivedData: dto.bunkersReceivedData,
          }),
          updatedAt: new Date(),
        },
        select: { id: true },
      });

      // Full replace of entries
      await tx.sofEntry.deleteMany({ where: { sofTimesheetId: timesheet.id } });

      if (dto.entries.length > 0) {
        await tx.sofEntry.createMany({
          data: dto.entries.map((e) => ({
            sofTimesheetId: timesheet.id,
            occurredAt: new Date(e.occurredAt),
            activityId: e.activityId ?? null,
            comment: e.comment ?? null,
            order: e.order,
          })),
        });
      }

      // Return the updated timesheet with all relations
      return tx.sofTimesheet.findUnique({
        where: { id: timesheet.id },
        include: {
          lastPort: { select: { id: true, name: true } },
          nextPort: { select: { id: true, name: true } },
          pier: { select: { id: true, name: true } },
          entries: {
            orderBy: { order: 'asc' },
            include: { activity: { select: { id: true, name: true } } },
          },
        },
      });
    });
  }

  private isFkViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003';
  }
}
