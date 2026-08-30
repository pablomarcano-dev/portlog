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
  formatBarrels,
  formatTons,
  etaNoticeLabel,
  resolveTransferRateUnit,
  calculateSofOperations,
  resolveSofCargoInputs,
  formatSofDuration,
  formatSofCalculationStamp,
  type NominationStatus,
  type NominationKind,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationListQuery,
  type NominationClientCreate,
  type NominationClientUpdate,
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
 * Actions addressed to the ship rather than to the nomination's client list.
 *
 * Both are the master's own correspondence — we ask the master for ETA notices
 * and we answer the master's reply — so they are mailed to the vessel and copied
 * to the companies that operate her. The charterer's addresses, which are what
 * the nomination's own list holds, are deliberately not used: the charterer is
 * not party to a message between the agent and the bridge.
 *
 * See the recipient block in getComposeData for the roster → address mapping.
 */
const MASTER_ADDRESSED_ACTIONS = new Set(['ETA_REQUEST', 'ETA_REPLY']);

/**
 * Column width the "Attn:" of a notice's To line starts at.
 *
 * The header is read in a monospace mail client, so the vessel name is padded
 * out to a fixed column rather than separated by a couple of spaces — a long
 * name simply pushes "Attn:" right instead of the column jumping per vessel.
 */
const ATTN_COLUMN = 24;

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
 * One column of figures padded so the thousands commas sit above each other.
 *
 *     ['1,949,562', '287,912.375']
 *       -> ['1,949,562    ',
 *           '  287,912.375']
 *
 * A bill of lading states barrels with no decimals and tonnages with three, so
 * a column right-aligned on its last character puts the comma of a barrel
 * figure four places off the comma of the tonnage under it — which is exactly
 * what the agency flagged. Padding the *integer* part to a common width instead
 * lines the commas up vertically and lets the decimals run off to the right;
 * the fractional part is then padded on its own so the column still ends flush
 * and whatever follows it stays aligned too.
 *
 * Values that are not figures at all (an empty cell, "NONE") are left alone
 * apart from the padding, since they have no comma to align.
 */
export function alignFigureColumn(values: string[]): string[] {
  const split = values.map((value) => {
    const dot = value.indexOf('.');
    return dot === -1
      ? { int: value, frac: '' }
      : { int: value.slice(0, dot), frac: value.slice(dot) };
  });
  const intWidth = Math.max(0, ...split.map((p) => p.int.length));
  const fracWidth = Math.max(0, ...split.map((p) => p.frac.length));
  return split.map((p) => `${p.int.padStart(intWidth)}${p.frac.padEnd(fracWidth)}`);
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
      if (nominationData.opPortId) {
        const port = await tx.port.findFirst({
          where: { id: nominationData.opPortId, branchId: nominationData.branchId },
          select: { id: true },
        });
        if (!port) throw new BadRequestException('Operating port is not assigned to this branch.');
      }
      const branchStaff = await tx.user.findMany({
        where: {
          branchId: nominationData.branchId,
          isActive: true,
          operationalRole: { not: null },
        },
        orderBy: { displayName: 'asc' },
        select: { displayName: true, email: true, operationalRole: true },
      });
      const staffNames = (roles: Array<'BRANCH_MANAGER' | 'SUPERVISOR' | 'SHIPPING_AGENT'>) =>
        branchStaff
          .filter((user) => user.operationalRole && roles.includes(user.operationalRole))
          .map((user) => user.displayName?.trim() || user.email)
          .join('; ');
      const nomination = await tx.nomination.create({
        data: {
          ...(nominationData as unknown as Prisma.NominationUncheckedCreateInput),
          mic: nominationData.mic?.trim() || staffNames(['BRANCH_MANAGER', 'SUPERVISOR']) || null,
          boardingClerk:
            nominationData.boardingClerk?.trim() || staffNames(['SHIPPING_AGENT']) || null,
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
      select: { id: true, status: true, kind: true, branchId: true },
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
    const effectiveBranchId = dto.branchId ?? existing.branchId;
    if (dto.opPortId && effectiveBranchId) {
      const port = await this.prisma.port.findFirst({
        where: { id: dto.opPortId, branchId: effectiveBranchId },
        select: { id: true },
      });
      if (!port) throw new BadRequestException('Operating port is not assigned to this branch.');
    }
    let staffDefaults: { mic?: string; boardingClerk?: string } = {};
    if (dto.branchId && dto.branchId !== existing.branchId) {
      const branchStaff = await this.prisma.user.findMany({
        where: { branchId: dto.branchId, isActive: true, operationalRole: { not: null } },
        orderBy: { displayName: 'asc' },
        select: { displayName: true, email: true, operationalRole: true },
      });
      const names = (roles: Array<'BRANCH_MANAGER' | 'SUPERVISOR' | 'SHIPPING_AGENT'>) =>
        branchStaff
          .filter((user) => user.operationalRole && roles.includes(user.operationalRole))
          .map((user) => user.displayName?.trim() || user.email)
          .join('; ');
      staffDefaults = {
        mic: names(['BRANCH_MANAGER', 'SUPERVISOR']),
        boardingClerk: names(['SHIPPING_AGENT']),
      };
    }
    try {
      const updated = await this.prisma.nomination.update({
        where: { id },
        data: {
          ...(dto as unknown as Prisma.NominationUncheckedUpdateInput),
          ...staffDefaults,
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
          // `emails` is the vessel's own inbox — the master's address, and the
          // To line of the two notices exchanged with the bridge. The owner and
          // operator hanging off the vessel carry the addresses those notices
          // are copied to; an Owner has no address column of its own, so its
          // contacts are the only way to reach it.
          shipParticular: {
            select: {
              name: true,
              emails: true,
              flag: { select: { name: true } },
              owner: { select: { name: true, contacts: { select: { emails: true } } } },
              operator: {
                select: { name: true, emails: true, contacts: { select: { emails: true } } },
              },
            },
          },
          // `emails` is the terminal's own distribution list.
          opPort: {
            select: {
              name: true,
              emails: true,
              terminalContacts: {
                where: { user: { isActive: true } },
                select: { recipientType: true, user: { select: { email: true } } },
              },
            },
          },
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
      captainMessage: string | null;
    } | null = null;

    if (isEtaType) {
      const pedr = await this.prisma.pedr.findUnique({
        where: { nominationId },
        select: { etaRecord: true },
      });
      etaRecord = pedr?.etaRecord ?? null;
    }

    // ---------------------------------------------------------------------------
    // Header parties — the companies a notice is addressed to
    //
    // The header of a notice names COMPANIES, not mailboxes. `to_recipients` /
    // `cc_recipients` print the raw address lists and are kept for the templates
    // still on them; `to_parties` / `cc_parties` are what the agency asked for:
    //
    //     To: HAKKAISAN               Attn: Master Anjan Saini
    //     Cc: MOL India Private Limited
    //     Cc: Mitsui O.S.K. Lines, Ltd., Tokyo/CRAMO
    //     Cc: MOL Global Ship Management Pte Ltd
    //
    // CLIENT LIST `type` → line (matched case-insensitively, trimmed):
    //
    //   To  ← the vessel herself. No roster row is involved: a notice to the
    //         bridge is addressed to the ship, so this is shipParticular.name
    //         plus "Attn: Master <master>" when the nomination records a master.
    //   Cc  ← every named row typed "Head Owner", "Disponent Owner",
    //         "Technical Operator" or "Commercial Operator" — OPERATOR_TYPES —
    //         in the order the roster lists them (sortOrder), deduped.
    //         "Charterer", "Time Charter", "Shipper" and "Receivers" rows are
    //         deliberately excluded: the cargo side is not party to the master's
    //         correspondence, and the charterer already has its own notices.
    //
    // The roster rows carry a hand-typed name and nothing else — only Shipper
    // rows link to master data — so these are names for the face of the letter,
    // never a source of addresses. The envelope is built from the vessel's own
    // owner/operator links further down.
    // ---------------------------------------------------------------------------
    const masterName = nomination.master?.trim() ?? '';
    const masterAttn = masterName ? `Attn: Master ${masterName}` : '';
    const ownerOperatorNames = NominationsService.resolveClientNamesByTypes(
      nomination.nominationClients,
      NominationsService.OPERATOR_TYPES,
    );

    // The countdown follows the latest ETA reported by the captain; the original
    // nomination ETA is the fallback until a report exists. The browser uses the
    // same precedence so the compose drawer and the server-rendered subject agree.
    const etaAnchor = etaRecord?.etaNotify ?? nomination.etaDate ?? null;

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
      flag: nomination.shipParticular?.flag?.name ?? '',
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
      // Named header parties — see the block above for the roster mapping.
      // `to_parties` is the value of the To line, the vessel padded out so the
      // "Attn:" of every notice starts in the same column.
      to_parties: masterAttn ? `${vesselName.padEnd(ATTN_COLUMN)}${masterAttn}` : vesselName,
      // The Attn on its own, for a template that lays the two out itself.
      master_attn: masterAttn,
      // Whole lines, "Cc:" included: there is one per owner/operator company and
      // a template cannot prefix each line of a multi-line value.
      cc_parties: ownerOperatorNames.map((name) => `Cc: ${name}`).join('\n'),
      // Subject-line countdown, e.g. "96 Hours ETA Notice". With no ETA on the
      // nomination there is no countdown to state, but the subject is built as
      // "<ref> - <label>", so an empty string left a dangling " - " on the face
      // of the mail. The unqualified phrase says the same thing without claiming
      // a countdown nobody computed.
      eta_notice_label: etaAnchor ? etaNoticeLabel(new Date(), etaAnchor) : 'ETA Notice',
      captain_message: etaRecord?.captainMessage ?? '',
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
    // Cargo Update and ETA to Terminal — enrich the Operation line with every
    // parcel's "<operation> <quantity> <unit> of <product>" description. Mirrors
    // the SOF operation format below, but lists all parcels (joined with "; ")
    // since both notices are inherently multi-parcel.
    //
    // The terminal notice used to print a bare "Operation : Load", leaving the
    // terminal to guess how much of what is coming; the agency asked for the
    // quantities on that line, which is the same enrichment the cargo update
    // already carried.
    // ---------------------------------------------------------------------------
    const enrichesOperationWithParcels = ['CARGO_UPDATE', 'ETA_TERMINAL'].includes(
      actionType.toUpperCase(),
    );
    if (enrichesOperationWithParcels) {
      if (actionType.toUpperCase() === 'CARGO_UPDATE') {
        // A cargo update carries the same event log the SOF does — the recipient
        // reads the figures against the history that produced them.
        templateVars.statement_of_facts_log = await this.buildSofEventLog(nominationId);
      }

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
      const includeBunkersDraftParcel = sof?.includeBunkersDraftParcel ?? true;
      const includeBillShipFigures = sof?.includeBillShipFigures ?? true;
      const includeLettersRemarks = sof?.includeLettersRemarks ?? true;
      const includeSlopBunkers = sof?.includeSlopBunkers ?? true;

      templateVars.arrival_conditions_section = includeBunkersDraftParcel
        ? NominationsService.formatVesselConditions(sof?.bunkersData, sof?.draftData, 'arrival')
        : '';
      templateVars.sailed_conditions_section = includeBunkersDraftParcel
        ? NominationsService.formatVesselConditions(sof?.bunkersData, sof?.draftData, 'sailing')
        : '';

      // Vessel Cargo Figures — the ship's own loaded figures, stated alongside
      // the bills of lading so the two can be compared.
      templateVars.vessel_cargo_figures_section = includeBillShipFigures
        ? NominationsService.formatVesselCargoFigures(sof?.shipFiguresData)
        : '';

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
      /**
       * The three figure rows of a bill, each with the formatter its unit is
       * stated in: barrels carry no decimals and are truncated, tonnages are
       * always quoted to three. Labels are equal width, so the figures start in
       * the same column on every row.
       */
      const BL_FIGURE_ROWS: [string, string, string, (value: unknown) => string][] = [
        ['Bbls at 60 F ..:', 'grossBbls', 'netBbls', formatBarrels],
        ['M/Tons at 60 F.:', 'grossMt', 'netMt', formatTons],
        ['L/Tons at 60 F.:', 'grossLt', 'netLt', formatTons],
      ];
      const blBlocks = blCols.map((colName, ci) => {
        // Each column is padded on its integer part so the thousands commas of a
        // barrel figure sit above those of the tonnage under it — the agency's
        // "the commas line up with the commas". Right-aligning the whole cell,
        // which is what this did before, put them four places apart.
        const gross = alignFigureColumn(
          BL_FIGURE_ROWS.map(([, key, , format]) => format(blRows[key]?.[ci])),
        );
        const net = alignFigureColumn(
          BL_FIGURE_ROWS.map(([, , key, format]) => format(blRows[key]?.[ci])),
        );
        const labelWidth = Math.max(...BL_FIGURE_ROWS.map(([label]) => label.length));
        const grossWidth = gross[0]?.length ?? 0;
        const netWidth = net[0]?.length ?? 0;
        const lines: string[] = [
          RULE,
          `${colName ? colName + ' - ' : ''}Bill #${ci + 1} Of Lading Figures:`,
          RULE,
          // Headings sit over the right edge of their own column, which the
          // padding above has made the same on every row.
          `${' '.repeat(labelWidth + 1)}${'Gross'.padStart(grossWidth)}  ${'Net'.padStart(netWidth)}`,
          ...BL_FIGURE_ROWS.map(([label], i) =>
            `${label} ${gross[i] ?? ''}  ${net[i] ?? ''}`.trimEnd(),
          ),
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
      templateVars.bl_figures_section = includeBillShipFigures ? blBlocks.join('\n') : '';

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
      templateVars.slop_bunkers_section = includeSlopBunkers ? slopBunkersBlocks.join('\n\n') : '';

      // Letters of protest — a zero-padded numbered list of the protests raised,
      // which is how they are read off the statement. The from/to pair is not
      // restated per line: the section heading already says who protested to whom.
      type LetterItem = { from?: string; to?: string; comment?: string };
      const lettersData = sof?.lettersData as { items?: LetterItem[] } | null;
      templateVars.letters_section = includeLettersRemarks
        ? (lettersData?.items ?? [])
            .map((l, i) => {
              const subject = (l.comment ?? '').trim() || (l.to ?? '').trim();
              return `${String(i + 1).padStart(2, '0')}. ${subject}`;
            })
            .join('\n')
        : '';

      // Remarks
      type RemarkItem = {
        remark?: string;
        beginDate?: string;
        beginTime?: string;
        endDate?: string;
        endTime?: string;
        comment?: string;
        delayCategory?: 'BEFORE' | 'DURING' | 'AFTER' | null;
      };
      // Remarks are the delay periods a demurrage claim is built from, so each
      // reads as a span: "Fm <start> To <end> <reason>". A remark without both
      // ends still prints, rather than being dropped for being incomplete.
      const remarksData = sof?.remarksData as {
        items?: RemarkItem[];
        cargoQuantity?: string;
        obq?: string;
      } | null;
      const remarkLines = (remarksData?.items ?? [])
        .map((r) => {
          const stamp = (date?: string, time?: string) =>
            [date?.trim(), time?.trim()].filter(Boolean).join(' ');
          const from = stamp(r.beginDate, r.beginTime);
          const to = stamp(r.endDate, r.endTime);
          const span = [from ? `Fm ${from}` : '', to ? `To ${to}` : ''].filter(Boolean).join(' ');
          const reason = (r.remark ?? '').trim();
          const category = r.delayCategory
            ? `[Delay ${r.delayCategory === 'BEFORE' ? 'Before' : r.delayCategory === 'DURING' ? 'During' : 'After'} Operations]`
            : '';
          return [category, span, reason, (r.comment ?? '').trim()].filter(Boolean).join(' ');
        })
        .filter((line) => line !== '')
        .join('\n');
      const cargoInputs = resolveSofCargoInputs(
        sof?.shipFiguresData as { rows?: Record<string, string[]> } | null,
        sof?.blFiguresData as { rows?: Record<string, string[]> } | null,
        remarksData?.cargoQuantity,
        remarksData?.obq,
      );
      const calculation = calculateSofOperations(
        sof?.entries ?? [],
        remarksData?.items ?? [],
        cargoInputs.cargoQuantity,
        cargoInputs.obq,
      );
      const operationalLines = [
        `Total Time Turnaround: ${formatSofDuration(calculation.turnaroundMs)} (From: ${formatSofCalculationStamp(calculation.turnaroundFrom)} To: ${formatSofCalculationStamp(calculation.turnaroundTo)})`,
        `Total Laytime: ${formatSofDuration(calculation.laytimeMs)} (From: ${formatSofCalculationStamp(calculation.laytimeFrom)} To: ${formatSofCalculationStamp(calculation.laytimeTo)})`,
        `Gross Operation Time: ${formatSofDuration(calculation.grossOperationMs)} (From: ${formatSofCalculationStamp(calculation.operationFrom)} To: ${formatSofCalculationStamp(calculation.operationTo)})`,
        `Delays Before Operations: ${formatSofDuration(calculation.delaysBeforeMs)}`,
        `Delays During Operations: ${formatSofDuration(calculation.delaysDuringMs)}`,
        `Delays After Operations: ${formatSofDuration(calculation.delaysAfterMs)}`,
        `Net Operation Time: ${formatSofDuration(calculation.netOperationMs)} (From: ${formatSofCalculationStamp(calculation.operationFrom)} To: ${formatSofCalculationStamp(calculation.operationTo)} less Delays During Operations)`,
        `Average Rate: ${calculation.averageRate == null ? 'Pending data' : `${calculation.averageRate.toFixed(2)} Barrels/hour`}`,
      ].join('\n');
      templateVars.remarks_section = includeLettersRemarks
        ? [remarkLines, operationalLines].filter(Boolean).join('\n\n')
        : '';

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
    // the client's. Two families are addressed elsewhere:
    //
    //   ETA_TERMINAL / NOR — both concern the vessel's readiness at the berth,
    //     so they go to the shipper and to the terminal the vessel is scheduled
    //     at: To is the operational port's address list plus the shipper's.
    //
    //   ETA_REQUEST / ETA_REPLY — the master's own correspondence, so they go to
    //     the ship and are copied to the companies that operate her. The header
    //     of these two prints the same parties by name (see to_parties /
    //     cc_parties above); this is the envelope that matches it:
    //
    //       To  ← shipParticular.emails            (the vessel's own inbox)
    //       Cc  ← shipParticular.operator.emails    (Commercial/Technical Operator)
    //           + shipParticular.operator.contacts[].emails
    //           + shipParticular.owner.contacts[].emails  (Head/Disponent Owner)
    //
    //     The CLIENT LIST rows those companies are *named* from carry a
    //     hand-typed name and no address — only Shipper rows link to master data
    //     — so the addresses are read from the vessel's own owner/operator
    //     links, which are real foreign keys. A notice is never mailed to a
    //     company picked by matching a typed name, for the same reason
    //     resolveShipper refuses to. Owner has no address column at all, so its
    //     registered contacts are the only way to reach it.
    //
    // In both cases the agency's internal copies are added deliberately, since
    // the notice has left the client's list: the branch handling the call is
    // copied and head office is blind-copied.
    //
    // If nothing is registered there is nothing to address it to, so it falls
    // back to the nomination's list rather than opening with an empty To that
    // reads as a bug. The agent can still edit the line before sending.
    // ---------------------------------------------------------------------------
    let toAddresses = nomination.emailTo;
    let ccAddresses = nomination.emailCc;
    let bccAddresses = nomination.emailBcc;

    const action = actionType.toUpperCase();
    const isTerminalAddressed = TERMINAL_ADDRESSED_ACTIONS.has(action);
    const isMasterAddressed = MASTER_ADDRESSED_ACTIONS.has(action);

    if (isTerminalAddressed) {
      const contacts = nomination.opPort?.terminalContacts ?? [];
      const terminalAndShipper = dedupeEmails([
        ...(nomination.opPort?.emails ?? []),
        ...contacts
          .filter((contact) => contact.recipientType === 'TO')
          .map((contact) => contact.user.email),
        ...shipper.emails,
      ]);
      if (terminalAndShipper.length > 0) toAddresses = terminalAndShipper;
      const terminalCc = contacts
        .filter((contact) => contact.recipientType === 'CC')
        .map((contact) => contact.user.email);
      const terminalBcc = contacts
        .filter((contact) => contact.recipientType === 'BCC')
        .map((contact) => contact.user.email);
      if (terminalCc.length > 0) ccAddresses = dedupeEmails(terminalCc);
      if (terminalBcc.length > 0) bccAddresses = dedupeEmails(terminalBcc);
    }

    if (isMasterAddressed) {
      const vessel = nomination.shipParticular;
      const vesselEmails = dedupeEmails(vessel?.emails ?? []);
      if (vesselEmails.length > 0) toAddresses = vesselEmails;

      const ownerOperatorEmails = dedupeEmails([
        ...(vessel?.operator?.emails ?? []),
        ...(vessel?.operator?.contacts ?? []).flatMap((c) => c.emails),
        ...(vessel?.owner?.contacts ?? []).flatMap((c) => c.emails),
      ]);
      // Replaces the client's Cc rather than joining it: the charterer is not
      // copied on what the agent writes to the bridge. With nothing registered
      // the nomination's own list stands, so the agent has something to edit.
      if (ownerOperatorEmails.length > 0) ccAddresses = ownerOperatorEmails;
    }

    if (isTerminalAddressed || isMasterAddressed) {
      // With the notice addressed outside the client's list, the agency's own
      // copies have to be added deliberately: the branch handling the call is
      // copied, and head office is blind-copied so the recipients do not see the
      // agency's internal oversight list. Both are appended to whatever the
      // notice already carries rather than replacing it.
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

    return entries
      .map((e) => {
        const d = new Date(e.occurredAt);
        const activityName = e.activity?.name ?? '';
        const line = `${formatNoticeDate(d)} ${fmtTime(d)} ${activityName}`;
        const comment = e.comment?.replace(/\s+/g, ' ').trim();
        return comment ? `${line} ${comment}` : line;
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
        // The three cargo rows are one column of figures, comma-aligned: barrels
        // are stated whole and tonnages to three decimals, so right-aligning
        // them would put their thousands separators out of line.
        const cargo = alignFigureColumn([
          formatBarrels(rows['bbls']?.[ci]),
          formatTons(rows['mtons']?.[ci]),
          formatTons(rows['ltons']?.[ci]),
        ]);
        // API and Temp are readings, not quantities — a gravity of 16.4 and a
        // loading temperature of 120.5 print as recorded rather than padded out
        // to a tonnage's three decimals, and stay outside the alignment above,
        // which exists for figures in the hundreds of thousands.
        const reading = (key: string) => formatQuantity(rows[key]?.[ci]);
        const measures: [string, string][] = [
          ["Ship's Loaded Figures Bbls:", cargo[0] ?? ''],
          ["Ship's Loaded Figures M/T:", cargo[1] ?? ''],
          ["Ship's Loaded Figures L/T:", cargo[2] ?? ''],
          ['API:', reading('api')],
          ['Temp:', reading('temp')],
        ];
        if (measures.every(([, value]) => value.trim() === '')) return '';

        return [
          RULE,
          `${colName ? colName + ' - ' : ''}Vessel Cargo Figures:`,
          RULE,
          ...measures
            .filter(([, value]) => value.trim() !== '')
            // trimEnd: a barrel figure is padded where a tonnage's decimals sit,
            // and that padding has nothing after it at the end of the line.
            .map(([label, value]) => `${label.padEnd(27)} ${value.padStart(16)}`.trimEnd()),
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

  /**
   * Every named CLIENT LIST row whose type is one of `types`, in the order the
   * roster lists them.
   *
   * Unlike {@link resolveClientByType}, which answers "who is the operator?"
   * with one name, this answers "who owns and operates her?" with all of them —
   * the notice header carries a Cc line per company. Rows are returned in the
   * agent's own display order rather than in the order of `types`, because that
   * is the order the client list is read in on screen. Blank rows (auto-created
   * on every nomination) are skipped, and a company named twice under two types
   * is listed once.
   */
  private static resolveClientNamesByTypes(
    clients: { type: string; name: string }[],
    types: readonly string[],
  ): string[] {
    const wanted = new Set(types.map((t) => t.toLowerCase()));
    const seen = new Set<string>();
    const names: string[] = [];
    for (const client of clients) {
      if (!wanted.has(client.type.trim().toLowerCase())) continue;
      const name = client.name.trim();
      if (name === '') continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
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
        captainMessage: null,
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
      captainMessage: r.captainMessage,
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
      captainMessage: body.captainMessage ?? null,
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
      captainMessage: record.captainMessage,
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
      includeBunkersDraftParcel: true,
      includeBillShipFigures: true,
      includeLettersRemarks: true,
      includeSlopBunkers: true,
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
          includeBunkersDraftParcel: dto.includeBunkersDraftParcel ?? true,
          includeBillShipFigures: dto.includeBillShipFigures ?? true,
          includeLettersRemarks: dto.includeLettersRemarks ?? true,
          includeSlopBunkers: dto.includeSlopBunkers ?? true,
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
          ...(dto.includeBunkersDraftParcel != null && {
            includeBunkersDraftParcel: dto.includeBunkersDraftParcel,
          }),
          ...(dto.includeBillShipFigures != null && {
            includeBillShipFigures: dto.includeBillShipFigures,
          }),
          ...(dto.includeLettersRemarks != null && {
            includeLettersRemarks: dto.includeLettersRemarks,
          }),
          ...(dto.includeSlopBunkers != null && {
            includeSlopBunkers: dto.includeSlopBunkers,
          }),
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
