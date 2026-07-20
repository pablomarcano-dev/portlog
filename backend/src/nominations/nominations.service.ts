import { readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  MethodNotAllowedException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Handlebars from 'handlebars';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import {
  isValidTransition,
  deriveNominationStatus,
  type NominationStatus,
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
} from '@portlog/schemas';

function formatSnOt(correlative: number, dateNominated: Date): string {
  const yy = String(dateNominated.getFullYear()).slice(-2);
  return `SN-${yy}/${String(correlative).padStart(4, '0')}`;
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
  return { ...rest, status, snOt: formatSnOt(rest.correlative, rest.dateNominated) };
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
} satisfies Prisma.SaleInclude;

@Injectable()
export class NominationsService {
  private readonly logger = new Logger(NominationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async create(dto: NominationCreateInput, userId: string) {
    const { nominationClients: clientRows, ...nominationData } = dto;
    return this.prisma.$transaction(async (tx) => {
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
      select: { id: true, status: true },
    });
    if (!existing) {
      throw new NotFoundException(`Nomination ${id} not found.`);
    }
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Nomination is cancelled and cannot be updated.');
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
      orderBy: { date: 'asc' },
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
    await this.assertSaleExists(nominationId, saleId);
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
          parcels: true,
          dateNominated: true,
          voyageNumber: true,
          correlative: true,
          layDaysFirst: true,
          layDaysLast: true,
          etaDate: true,
          shipParticular: { select: { name: true } },
          opPort: { select: { name: true } },
          lastPort: { select: { name: true } },
          nextPort: { select: { name: true } },
          branch: {
            select: {
              name: true,
              code: true,
              email: true,
              address: true,
              phone: true,
              fax: true,
              mobile24h: true,
              coverage: true,
              contactName: true,
              contactTitle: true,
              contactMobile: true,
              contactEmail: true,
              centralEmails: true,
            },
          },
        },
      }),
      this.prisma.user.findUnique({
        where: { email: agentEmail },
        select: { displayName: true, phone: true, mobile: true, fax: true },
      }),
    ]);

    if (!nomination) throw new NotFoundException(`Nomination ${nominationId} not found.`);

    // ---------------------------------------------------------------------------
    // Template path — map action type to file path within templates/
    // ---------------------------------------------------------------------------
    const TEMPLATE_PATHS: Record<string, string> = {
      ACKNOWLEDGEMENT: '01_prearrival/00_nomination_acceptance.hbs',
      PREARRIVAL: '01_prearrival/10_prearrival_notification.hbs',
      ETA_REQUEST: '01_prearrival/01_eta_request_to_master.hbs',
      ETA_TERMINAL: '01_prearrival/03_eta_forwarded_to_terminal.hbs',
      ETA_REPLY: '01_prearrival/02_reply_to_master_eta_notice.hbs',
      CARGO_UPDATE: '02_statement_of_facts/07_cargo_update.hbs',
      SOF: '02_statement_of_facts/15_final_sof.hbs',
    };
    const relPath = TEMPLATE_PATHS[actionType.toUpperCase()] ?? `${actionType.toLowerCase()}.hbs`;
    const templatePath = resolve(process.cwd(), 'templates', relPath);

    // ---------------------------------------------------------------------------
    // Template variables
    // ---------------------------------------------------------------------------
    const fmtDate = (d: Date | null) =>
      d
        ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
        : '';

    const fmtTime = (d: Date | null) =>
      d
        ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
        : '';

    const parcels = Array.isArray(nomination.parcels) ? nomination.parcels : [];
    const firstParcel = (parcels as Array<Record<string, unknown>>)[0] ?? {};
    const branch = nomination.branch;

    const snRef = formatSnOt(nomination.correlative, nomination.dateNominated);
    const vesselName = nomination.shipParticular?.name ?? '';
    const voyageNo = nomination.voyageNumber ?? '';
    const terminalName = nomination.opPort?.name ?? '';
    const branchCode = branch?.code ?? '';
    const yy = String(nomination.dateNominated.getFullYear()).slice(-2);
    // Default matches the nomination form's auto-generated subject. If the user
    // edited the nomination's subject, that edit is preserved and reused here so
    // every email for this nomination shares the same reference line.
    const defaultRefLine = `${vesselName} - Calling to ${terminalName} SN${nomination.correlative}/${yy}/${branchCode}`;
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
      ref_line: refLine,
      laycan:
        nomination.layDaysFirst || nomination.layDaysLast
          ? `${fmtDate(nomination.layDaysFirst)} - ${fmtDate(nomination.layDaysLast)}`
          : '',
      cargo_quantity: String(firstParcel['quantity'] ?? ''),
      cargo_grade: String(firstParcel['product'] ?? ''),
      lay_days:
        nomination.layDaysFirst || nomination.layDaysLast
          ? `${fmtDate(nomination.layDaysFirst)} - ${fmtDate(nomination.layDaysLast)}`
          : '',
      operation: String(firstParcel['operation'] ?? firstParcel['product'] ?? ''),
      // Cargo update — multi-parcel loop data
      parcels: (parcels as Array<Record<string, unknown>>).map((p) => ({
        cargo_grade: String(p['product'] ?? ''),
        operation: String(p['operation'] ?? ''),
        qty_on_board: String(p['qtyOnBoard'] ?? '0'),
        qty_on_board_unit: String(p['qtyOnBoardUnit'] ?? p['unit'] ?? ''),
        qty_to_go: String(p['qtyToGo'] ?? '0'),
        qty_to_go_unit: String(p['qtyToGoUnit'] ?? p['unit'] ?? ''),
        loading_rate: String(p['loadingRate'] ?? '0'),
        loading_rate_unit: String(p['loadingRateUnit'] ?? ''),
        t_etc: String(p['etcDate'] ?? ''),
      })),
      last_port: nomination.lastPort?.name ?? '',
      next_port: nomination.nextPort?.name ?? '',
      flag: '',
      master_name: '',
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
      agent_title: '',
      agent_email: branch?.email ?? agentEmail,
      agent_mobile: agent?.mobile ?? branch?.mobile24h ?? '',
      branch_office: branch?.name ?? '',
      branch_coverage: branch?.coverage ?? '',
      branch_address: branch?.address ?? '',
      branch_phone: agent?.phone ?? branch?.phone ?? '',
      branch_fax: agent?.fax ?? branch?.fax ?? '',
      contact_person: branch?.contactName ?? '',
      contact_title: branch?.contactTitle ?? '',
      contact_mobile: branch?.contactMobile ?? '',
      contact_email: branch?.contactEmail ?? '',
      central_emails: branch?.centralEmails?.join('; ') ?? '',
      // Cargo update date/time — rendered at time of compose
      update_date: fmtDate(new Date()),
      update_time: fmtTime(new Date()),
      t_etd: '',
      t_etd_berth: '',
      // SOF-specific — populated below when actionType === 'SOF'
      statement_of_facts_log: '',
      bl_figures_section: '',
      slop_bunkers_section: '',
      letters_section: '',
      remarks_section: '',
    };

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

      const SOF_MONTHS = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const ordinal = (n: number) => {
        const v = n % 100;
        return (
          n +
          (['th', 'st', 'nd', 'rd', 'th'][(v - 20) % 10] ??
            ['th', 'st', 'nd', 'rd', 'th'][v] ??
            'th')
        );
      };
      const fmtSofDate = (d: Date) =>
        `${SOF_MONTHS[d.getMonth()]}. ${ordinal(d.getDate())}, ${d.getFullYear()}`;

      // Log entries — a "." activity is a continuation marker, so its comment
      // stays inline on the same row instead of wrapping to an indented line.
      const logLines = (sof?.entries ?? []).map((e) => {
        const d = new Date(e.occurredAt);
        const activityName = e.activity?.name ?? '';
        const line = `${fmtSofDate(d)}  ${fmtTime(d)}  ${activityName}`;
        if (!e.comment) return line;
        return activityName === '.' ? `${line}  ${e.comment}` : `${line}\n     ${e.comment}`;
      });
      templateVars.statement_of_facts_log = logLines.join('\n');

      // BL Figures section (one block per cargo column)
      type DynRows = Record<string, string[]>;
      const blData = sof?.blFiguresData as { columns?: string[]; rows?: DynRows } | null;
      const blCols = blData?.columns ?? [];
      const blRows = blData?.rows ?? {};
      const v = (key: string, col: number) => blRows[key]?.[col] ?? '';
      const blBlocks = blCols.map((colName, ci) => {
        const lines: string[] = [
          ``,
          `${colName ? colName + ' ' : ''}Bill of Lading Figures :`,
          `-----------------------------------------------------------`,
          `                Gross            Net`,
          `Bbls at 60 grade F.  : ${v('grossBbls', ci).padStart(12)}  ${v('netBbls', ci).padStart(12)}`,
          `M/Tons at 60 grade F.: ${v('grossMt', ci).padStart(12)}  ${v('netMt', ci).padStart(12)}`,
          `L/Tons at 60 grade F.: ${v('grossLt', ci).padStart(12)}  ${v('netLt', ci).padStart(12)}`,
          ``,
          `Shipper  : ${v('shipper', ci)}`,
          `Consignee: ${v('consignee', ci)}`,
          `B/L Date : ${v('date', ci)}`,
          `Disport  : ${v('destination', ci)}`,
          `Scaccode : ${v('scacCode', ci)}`,
          `(${v('originalOnBoard', ci) === 'true' ? 'X' : ' '}) Original Bill on Board`,
        ];
        return lines.join('\n');
      });
      templateVars.bl_figures_section = blBlocks.join('\n\n');

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

      // Letters of protest
      type LetterItem = { from?: string; to?: string; comment?: string };
      const lettersData = sof?.lettersData as { items?: LetterItem[] } | null;
      templateVars.letters_section = (lettersData?.items ?? [])
        .map(
          (l, i) =>
            `${i + 1}. From: ${l.from ?? ''} — To: ${l.to ?? ''}${l.comment ? `\n   ${l.comment}` : ''}`,
        )
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
      const remarksData = sof?.remarksData as { items?: RemarkItem[] } | null;
      templateVars.remarks_section = (remarksData?.items ?? [])
        .map((r) => {
          const begin = r.beginDate
            ? ` Begin: ${r.beginDate}${r.beginTime ? ' ' + r.beginTime : ''}`
            : '';
          const end = r.endDate ? ` End: ${r.endDate}${r.endTime ? ' ' + r.endTime : ''}` : '';
          return `${r.remark ?? ''}${begin}${end}${r.comment ? `\n  ${r.comment}` : ''}`;
        })
        .join('\n');

      // Operation string
      const fp = (nomination.parcels as Array<Record<string, unknown>>)[0] ?? {};
      if (fp['operation'] || fp['product']) {
        templateVars.operation = [
          fp['operation'],
          fp['quantity'] ? `${fp['quantity']} ${fp['unit'] ?? ''}`.trim() : '',
          fp['product'] ? `of ${fp['product']}` : '',
        ]
          .filter(Boolean)
          .join(' ');
      }

      // Lay days in SOF format: "28 May, 2026 - 30 May, 2026"
      const fmtSofLayDay = (d: Date | null) =>
        d ? `${d.getDate()} ${SOF_MONTHS[d.getMonth()]}, ${d.getFullYear()}` : '';
      if (nomination.layDaysFirst || nomination.layDaysLast) {
        templateVars.lay_days = `${fmtSofLayDay(nomination.layDaysFirst)} - ${fmtSofLayDay(nomination.layDaysLast)}`;
      }
    }

    // ---------------------------------------------------------------------------
    // Render — extract subject from source BEFORE compiling ({{!-- --}} is stripped)
    // ---------------------------------------------------------------------------
    const templateSource = await readFile(templatePath, 'utf8');

    const subjectSourceMatch = /\{\{!--\s*Subject:\s*(.+?)\s*--\}\}/.exec(templateSource);
    const subjectTemplate =
      subjectSourceMatch?.[1] ?? nomination.subject ?? nomination.shipParticular?.name ?? '';
    const subject = Handlebars.compile(subjectTemplate)(templateVars);

    const bodyText = Handlebars.compile(templateSource)(templateVars);

    // Wrap plain-text output in <pre> for correct iframe rendering
    const bodyHtml = bodyText.trimStart().startsWith('<')
      ? bodyText
      : `<pre style="font-family:'Courier New',Consolas,monospace;font-size:13px;line-height:1.5;white-space:pre-wrap;padding:16px;margin:0;">${bodyText}</pre>`;

    return {
      subject,
      toAddresses: nomination.emailTo,
      ccAddresses: nomination.emailCc,
      bccAddresses: nomination.emailBcc,
      bodyHtml,
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

  private async assertSaleExists(nominationId: string, saleId: string): Promise<void> {
    const exists = await this.prisma.sale.findFirst({
      where: { id: saleId, nominationId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`Sale ${saleId} not found on nomination ${nominationId}.`);
    }
  }

  /** A stale/bad clientId or serviceId FK violation should surface as a 400, not a 500. */
  private rethrowSaleFkViolation(err: unknown): void {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new BadRequestException('Unknown client or service id.');
    }
  }

  async sendEmail(
    nominationId: string,
    body: {
      subDocType: string;
      toAddresses: string[];
      ccAddresses: string[];
      bccAddresses: string[];
      subject: string;
      bodyHtml: string;
    },
    userId: string,
  ): Promise<void> {
    const pedr = await this.prisma.pedr.findUnique({
      where: { nominationId },
      select: { id: true },
    });
    if (!pedr) throw new NotFoundException(`No PEDR found for nomination ${nominationId}.`);

    const dispatch = await this.prisma.emailDispatch.create({
      data: {
        pedrId: pedr.id,
        subDocType: body.subDocType as import('@prisma/client').SubDocType,
        toAddresses: body.toAddresses,
        ccAddresses: body.ccAddresses,
        bccAddresses: body.bccAddresses,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        sentById: userId,
      },
    });

    await this.emailService.send({
      to: body.toAddresses,
      cc: body.ccAddresses,
      bcc: body.bccAddresses,
      subject: body.subject,
      html: body.bodyHtml,
    });

    await this.prisma.emailDispatch.update({
      where: { id: dispatch.id },
      data: { sentAt: new Date() },
    });
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
