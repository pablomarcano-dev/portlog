import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ServiceRequestDetailsSchema,
  ServiceRequestSendReadinessSchema,
  formatControlNumber,
  requiresAuthorizationDocument,
  resolveServiceLabel,
  type ServiceRequestCreate,
  type ServiceRequestDispatch as ServiceRequestDispatchDto,
  type ServiceRequestListItem,
  type ServiceRequestListQuery,
  type ServiceRequestListResponse,
  type ServiceRequestRead,
  type ServiceRequestSend,
  type ServiceRequestTransition,
  type ServiceRequestUpdate,
} from '@portlog/schemas';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import { wrapPlainTextEmailBody } from '../email/email-body.util.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { buildOrderContext } from './order-context.js';

/**
 * Everything the read DTO needs, in one round trip. Declared once so the
 * mapper's parameter type stays in sync with every query that feeds it.
 */
const DETAIL_INCLUDE = {
  shipParticular: { select: { id: true, name: true, imoNumber: true } },
  branch: { select: { id: true, name: true, code: true } },
  supplier: { select: { id: true, name: true, emails: true } },
  port: { select: { id: true, name: true } },
  pier: { select: { id: true, name: true } },
  billToClient: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true } },
  documents: {
    select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ServiceRequestInclude;

type ServiceRequestWithRelations = Prisma.ServiceRequestGetPayload<{
  include: typeof DETAIL_INCLUDE;
}>;

/** Statuses whose operational fields are frozen. */
const LOCKED_STATUSES = ['SENT', 'COMPLETED', 'CANCELLED'] as const;

/**
 * The only fields an operator may still change after the purchase order has
 * gone out. Everything else describes what was ordered, and the provider
 * already has that in writing.
 *
 * `physicalVoucherNo` and `actualCost` exist precisely to be filled in
 * afterwards — the boat has to come back before anyone can write the slip
 * number down.
 */
const POST_SEND_EDITABLE_FIELDS = [
  'physicalVoucherNo',
  'actualCost',
  'completedAt',
  'notes',
] as const;

@Injectable()
export class ServiceRequestsService {
  private readonly logger = new Logger(ServiceRequestsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
    private readonly attachments: AttachmentsService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async create(dto: ServiceRequestCreate, userId: string): Promise<ServiceRequestRead> {
    this.assertDetailsMatchType(dto.type, dto.details);

    const created = await this.prisma.serviceRequest.create({
      data: {
        type: dto.type,
        shipParticularId: dto.shipParticularId,
        branchId: dto.branchId,
        nominationId: dto.nominationId ?? null,
        supplierId: dto.supplierId ?? null,
        location: dto.location ?? null,
        portId: dto.portId ?? null,
        pierId: dto.pierId ?? null,
        scheduledAt: dto.scheduledAt,
        completedAt: dto.completedAt ?? null,
        physicalVoucherNo: dto.physicalVoucherNo ?? null,
        notes: dto.notes ?? null,
        details: dto.details as unknown as Prisma.InputJsonValue,
        billToClientId: dto.billToClientId ?? null,
        estimatedCost: dto.estimatedCost ?? null,
        actualCost: dto.actualCost ?? null,
        currency: dto.currency,
        createdById: userId,
      },
      include: DETAIL_INCLUDE,
    });

    this.logger.log({
      event: 'service-request.create',
      id: created.id,
      type: created.type,
      userId,
    });
    return this.toDto(created);
  }

  async findOne(id: string): Promise<ServiceRequestRead> {
    return this.toDto(await this.getOrThrow(id));
  }

  async update(id: string, dto: ServiceRequestUpdate): Promise<ServiceRequestRead> {
    const existing = await this.getOrThrow(id);

    if ((LOCKED_STATUSES as readonly string[]).includes(existing.status)) {
      const attempted = Object.keys(dto).filter(
        (key) => !(POST_SEND_EDITABLE_FIELDS as readonly string[]).includes(key),
      );
      if (attempted.length > 0) {
        throw new ConflictException(
          `Request is ${existing.status} — only ${POST_SEND_EDITABLE_FIELDS.join(', ')} may still be changed (attempted: ${attempted.join(', ')})`,
        );
      }
    }

    if (dto.details !== undefined) {
      this.assertDetailsMatchType(existing.type, dto.details);
    }

    // `scheduledAt` must stay before `completedAt`; a PATCH can move either one,
    // so the check runs against the merged value rather than the body alone.
    const scheduledAt = dto.scheduledAt ?? existing.scheduledAt;
    const completedAt = dto.completedAt === undefined ? existing.completedAt : dto.completedAt;
    if (completedAt != null && scheduledAt > completedAt) {
      throw new BadRequestException('Completion time must be on or after the scheduled time');
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data: {
        ...(dto.shipParticularId !== undefined && { shipParticularId: dto.shipParticularId }),
        ...(dto.branchId !== undefined && { branchId: dto.branchId }),
        ...(dto.nominationId !== undefined && { nominationId: dto.nominationId }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.portId !== undefined && { portId: dto.portId }),
        ...(dto.pierId !== undefined && { pierId: dto.pierId }),
        ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt }),
        ...(dto.completedAt !== undefined && { completedAt: dto.completedAt }),
        ...(dto.physicalVoucherNo !== undefined && { physicalVoucherNo: dto.physicalVoucherNo }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.details !== undefined && {
          details: dto.details as unknown as Prisma.InputJsonValue,
        }),
        ...(dto.billToClientId !== undefined && { billToClientId: dto.billToClientId }),
        ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
        ...(dto.actualCost !== undefined && { actualCost: dto.actualCost }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
      },
      include: DETAIL_INCLUDE,
    });
    return this.toDto(updated);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.getOrThrow(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException(
        'Only DRAFT requests can be deleted — cancel the request instead',
      );
    }
    if (existing.minioKey) {
      try {
        await this.storage.deleteFile(existing.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.delete.storage.warn', id, err });
      }
    }
    // EmailAttachment rows cascade with the request; their MinIO objects are
    // swept by the existing attachments cleanup cron.
    await this.prisma.serviceRequest.delete({ where: { id } });
  }

  async transition(id: string, dto: ServiceRequestTransition): Promise<ServiceRequestRead> {
    const existing = await this.getOrThrow(id);

    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Request is already cancelled');
    }
    if (dto.status === 'COMPLETED') {
      if (existing.status !== 'SENT') {
        throw new ConflictException('Only a SENT request can be marked completed');
      }
    }

    const updated = await this.prisma.serviceRequest.update({
      where: { id },
      data:
        dto.status === 'CANCELLED'
          ? { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: dto.reason ?? null }
          : { status: 'COMPLETED', completedAt: existing.completedAt ?? new Date() },
      include: DETAIL_INCLUDE,
    });
    return this.toDto(updated);
  }

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  async list(query: ServiceRequestListQuery): Promise<ServiceRequestListResponse> {
    const where: Prisma.ServiceRequestWhereInput = {
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.shipParticularId && { shipParticularId: query.shipParticularId }),
      ...(query.branchId && { branchId: query.branchId }),
      ...(query.supplierId && { supplierId: query.supplierId }),
      ...(query.nominationId && { nominationId: query.nominationId }),
      ...((query.dateFrom || query.dateTo) && {
        scheduledAt: {
          ...(query.dateFrom && { gte: query.dateFrom }),
          ...(query.dateTo && { lte: query.dateTo }),
        },
      }),
    };

    if (query.search) {
      const search = query.search.trim();
      const or: Prisma.ServiceRequestWhereInput[] = [
        { shipParticular: { name: { contains: search, mode: 'insensitive' } } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { physicalVoucherNo: { contains: search, mode: 'insensitive' } },
      ];
      // A bare number, or the numeric part of "SN1234/26/PLC", matches the
      // control number — that is how operators quote a request over the phone.
      const digits = search.match(/\d+/)?.[0];
      if (digits) {
        const correlative = Number.parseInt(digits, 10);
        if (Number.isSafeInteger(correlative)) or.push({ correlative });
      }
      where.AND = [{ OR: or }];
    }

    const [rows, total] = await Promise.all([
      this.prisma.serviceRequest.findMany({
        where,
        include: {
          shipParticular: { select: { name: true } },
          branch: { select: { code: true } },
          supplier: { select: { name: true } },
        },
        orderBy: { scheduledAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.serviceRequest.count({ where }),
    ]);

    const items: ServiceRequestListItem[] = rows.map((row) => ({
      id: row.id,
      correlative: row.correlative,
      controlNumber: formatControlNumber(row.correlative, row.createdAt, row.branch.code),
      type: row.type,
      status: row.status,
      vesselName: row.shipParticular.name,
      branchCode: row.branch.code,
      supplierName: row.supplier?.name ?? null,
      serviceLabel: resolveServiceLabel(row.details),
      location: row.location,
      scheduledAt: row.scheduledAt,
      physicalVoucherNo: row.physicalVoucherNo,
      actualCost: row.actualCost == null ? null : row.actualCost.toNumber(),
      currency: row.currency,
      sentAt: row.sentAt,
    }));

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  // -------------------------------------------------------------------------
  // Authorisation documents
  // -------------------------------------------------------------------------

  async addDocuments(id: string, attachmentIds: string[]): Promise<ServiceRequestRead> {
    const existing = await this.getOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Cannot add documents to a cancelled request');
    }
    await this.attachments.attachToServiceRequest(attachmentIds, id);
    return this.toDto(await this.getOrThrow(id));
  }

  async removeDocument(id: string, attachmentId: string): Promise<ServiceRequestRead> {
    await this.getOrThrow(id);
    await this.attachments.removeFromServiceRequest(attachmentId, id);
    return this.toDto(await this.getOrThrow(id));
  }

  // -------------------------------------------------------------------------
  // Purchase order
  // -------------------------------------------------------------------------

  /**
   * Render the purchase order to MinIO and return its key. Idempotent — a
   * regenerate replaces the previous object, which matters while the operator
   * is still tweaking a draft.
   */
  async generateOrderPdf(id: string): Promise<{ minioKey: string }> {
    const request = await this.getOrThrow(id);
    if (request.status === 'CANCELLED') {
      throw new ConflictException('Cannot generate an order for a cancelled request');
    }

    const buffer = await this.pdf.renderTemplate('orden-de-compra.hbs', buildOrderContext(request));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newKey = `service-requests/${id}/orden-de-compra-${timestamp}.pdf`;

    if (request.minioKey) {
      try {
        await this.storage.deleteFile(request.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.pdf.replace.warn', id, err });
      }
    }

    await this.storage.uploadFile(newKey, buffer, 'application/pdf');
    await this.prisma.serviceRequest.update({
      where: { id },
      data: { minioKey: newKey, pdfGeneratedAt: new Date() },
    });

    return { minioKey: newKey };
  }

  async downloadOrderPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.getOrThrow(id);
    if (!request.minioKey) {
      throw new BadRequestException('No order has been generated yet');
    }
    const buffer = await this.storage.getFileBuffer(request.minioKey);
    const control = formatControlNumber(
      request.correlative,
      request.createdAt,
      request.branch.code,
    );
    return { buffer, filename: `OC-${control.replace(/\//g, '-')}.pdf` };
  }

  /**
   * Generate the purchase order and email it — the one button the specs all
   * end on.
   *
   * 1. Creates the purchase order with the breakdown of the selected service.
   * 2. Emails it to the provider.
   * 3. Records the correlative for internal control (already minted at create;
   *    this is where it is stamped onto the dispatch record).
   *
   * Follows the SH-document dispatch contract: the status flips to SENT
   * *before* SMTP is attempted and is deliberately NOT rolled back on failure.
   * The dispatch row carries the error and the operator re-sends by hand. A
   * silent revert would let two operators each believe the other had sent it.
   */
  async sendOrder(
    id: string,
    dto: ServiceRequestSend,
    userId: string,
  ): Promise<{ request: ServiceRequestRead; dispatch: { id: string; sentAt: string | null } }> {
    const request = await this.getOrThrow(id);

    if (request.status === 'CANCELLED') {
      throw new ConflictException('Cannot send a cancelled request');
    }

    // Golden Rule 5 — the readiness rules the Review step showed the operator
    // are re-checked here, because the frontend check is advisory only.
    const readiness = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: request.supplierId,
      details: request.details,
      documentCount: request.documents.length,
    });
    if (!readiness.success) {
      throw new BadRequestException(
        readiness.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    // Regenerate rather than reuse: the operator may have edited the request
    // since the last preview, and the provider must receive what is on screen.
    const { minioKey } = await this.generateOrderPdf(id);

    const control = formatControlNumber(
      request.correlative,
      request.createdAt,
      request.branch.code,
    );
    const subject =
      dto.subject ??
      `Purchase Order ${control} — ${request.shipParticular.name} — ${resolveServiceLabel(request.details)}`;

    // Resolve every attachment up front so a bad id or an oversize payload
    // aborts before the request is flipped to SENT.
    const extraAttachments = await this.attachments.resolveForSend(dto.attachmentIds ?? []);
    const requestDocuments = await this.attachments.resolveServiceRequestDocuments(id);

    const bodyHtml = dto.bodyText ? wrapPlainTextEmailBody(dto.bodyText) : null;

    const { dispatch } = await this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.serviceRequestDispatch.create({
        data: {
          serviceRequestId: id,
          toAddresses: dto.toAddresses,
          ccAddresses: dto.ccAddresses,
          bccAddresses: dto.bccAddresses,
          subject,
          bodyHtml,
          pdfStorageKey: minioKey,
          sentById: userId,
          sentAt: null,
          error: null,
        },
      });
      await tx.serviceRequest.update({
        where: { id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          // Snapshot where the order went, so a later edit of the supplier's
          // contact list cannot rewrite history.
          providerEmails: dto.toAddresses,
        },
      });
      return { dispatch };
    });

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.storage.getFileBuffer(minioKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.serviceRequestDispatch.update({
        where: { id: dispatch.id },
        data: { error: `Failed to read the order PDF from storage: ${message}` },
      });
      throw new InternalServerErrorException('Failed to read the order PDF from storage');
    }

    let sentAt: Date | null = null;
    try {
      await this.email.send({
        to: dto.toAddresses,
        cc: dto.ccAddresses,
        bcc: dto.bccAddresses,
        subject,
        html: bodyHtml ?? '',
        attachments: [
          {
            filename: `OC-${control.replace(/\//g, '-')}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
          // The authorisation letter rides along with every send — the provider
          // needs it to be allowed alongside the vessel.
          ...requestDocuments,
          ...extraAttachments,
        ],
      });
      sentAt = new Date();
      await this.prisma.serviceRequestDispatch.update({
        where: { id: dispatch.id },
        data: { sentAt },
      });
      await this.attachments.linkToServiceRequestDispatch(dto.attachmentIds ?? [], dispatch.id);
      this.logger.log({ event: 'service-request.sent', id, control, dispatchId: dispatch.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.serviceRequestDispatch.update({
        where: { id: dispatch.id },
        data: { error: message },
      });
      this.logger.error({ event: 'service-request.send.failed', id, err: message });
      // Status is already SENT — deliberately not reverted. See the doc comment.
    }

    return {
      request: this.toDto(await this.getOrThrow(id)),
      dispatch: { id: dispatch.id, sentAt: sentAt?.toISOString() ?? null },
    };
  }

  async listDispatches(id: string): Promise<ServiceRequestDispatchDto[]> {
    await this.getOrThrow(id);
    const rows = await this.prisma.serviceRequestDispatch.findMany({
      where: { serviceRequestId: id },
      include: { sentBy: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      toAddresses: row.toAddresses,
      ccAddresses: row.ccAddresses,
      bccAddresses: row.bccAddresses,
      subject: row.subject,
      sentAt: row.sentAt,
      error: row.error,
      sentBy: row.sentBy,
      createdAt: row.createdAt,
    }));
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async getOrThrow(id: string): Promise<ServiceRequestWithRelations> {
    const row = await this.prisma.serviceRequest.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException(`Service request ${id} not found`);
    return row;
  }

  /**
   * The `details` union discriminates on its own `type` literal, so a caller
   * could post a TUG payload to a LAUNCH request and pass schema validation.
   * The two must agree or the stored row would render as the wrong form.
   */
  private assertDetailsMatchType(type: string, details: unknown): void {
    const parsed = ServiceRequestDetailsSchema.safeParse(details);
    if (!parsed.success) {
      throw new BadRequestException('Invalid service details payload');
    }
    if (parsed.data.type !== type) {
      throw new BadRequestException(
        `Details payload is for a ${parsed.data.type} request but this request is ${type}`,
      );
    }
  }

  private toDto(row: ServiceRequestWithRelations): ServiceRequestRead {
    return {
      id: row.id,
      correlative: row.correlative,
      controlNumber: formatControlNumber(row.correlative, row.createdAt, row.branch.code),
      type: row.type,
      status: row.status,

      shipParticularId: row.shipParticularId,
      shipParticular: row.shipParticular,
      branchId: row.branchId,
      branch: row.branch,
      nominationId: row.nominationId,
      supplierId: row.supplierId,
      supplier: row.supplier,
      providerEmails: row.providerEmails,

      location: row.location,
      portId: row.portId,
      port: row.port,
      pierId: row.pierId,
      pier: row.pier,

      scheduledAt: row.scheduledAt,
      completedAt: row.completedAt,
      physicalVoucherNo: row.physicalVoucherNo,
      notes: row.notes,
      // Parsed rather than passed through, so defaults added to the union since
      // the row was written (a new checklist flag, say) are filled in on read.
      details: ServiceRequestDetailsSchema.parse(row.details),

      billToClientId: row.billToClientId,
      billToClient: row.billToClient,
      estimatedCost: row.estimatedCost == null ? null : row.estimatedCost.toNumber(),
      actualCost: row.actualCost == null ? null : row.actualCost.toNumber(),
      currency: row.currency,

      authorizationRequired: requiresAuthorizationDocument(row.details),
      documents: row.documents,

      minioKey: row.minioKey,
      pdfGeneratedAt: row.pdfGeneratedAt,
      sentAt: row.sentAt,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,

      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
