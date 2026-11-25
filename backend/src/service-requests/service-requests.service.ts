import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import {
  ServiceRequestDetailsSchema,
  ServiceRequestSendReadinessSchema,
  formatControlNumber,
  hasManagementAccess,
  resolveNominationReference,
  requiresAuthorizationDocument,
  resolveServiceLabel,
  type ServiceRequestCreate,
  type ServiceRequestDispatch as ServiceRequestDispatchDto,
  type ServiceRequestListItem,
  type ServiceRequestListQuery,
  type ServiceRequestListResponse,
  type ServiceRequestRead,
  type ServiceRequestReceipt,
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
import { appendBranchCc } from '../email/email-address.util.js';
import { buildOperationalOrderData, buildOrderContext } from './order-context.js';
import { OperationalOrderDocxService } from './operational-order-docx.service.js';
import type { RequestUser } from '../auth/jwt.strategy.js';

/**
 * Everything the read DTO needs, in one round trip. Declared once so the
 * mapper's parameter type stays in sync with every query that feeds it.
 */
const DETAIL_INCLUDE = {
  shipParticular: { select: { id: true, name: true, imoNumber: true } },
  branch: {
    select: {
      id: true,
      name: true,
      code: true,
      emails: true,
      contactEmails: true,
      centralEmails: true,
    },
  },
  supplier: { select: { id: true, name: true, emails: true } },
  port: { select: { id: true, name: true } },
  pier: { select: { id: true, name: true } },
  billToClient: { select: { id: true, name: true } },
  createdBy: { select: { id: true, email: true, displayName: true } },
  approvedBy: { select: { id: true, email: true, displayName: true } },
  issuedBy: { select: { id: true, email: true, displayName: true } },
  receiptRecordedBy: { select: { id: true, email: true, displayName: true } },
  receiptAttachment: {
    select: { id: true, filename: true, mimeType: true, sizeBytes: true, createdAt: true },
  },
  nomination: {
    select: { correlative: true, dateNominated: true, kind: true, businessReference: true },
  },
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
  'reconciliationNotes',
  'supplierInvoiceNo',
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
    private readonly operationalOrderDocx: OperationalOrderDocxService,
  ) {}

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  async create(
    dto: ServiceRequestCreate,
    userId: string,
    actor?: RequestUser,
  ): Promise<ServiceRequestRead> {
    this.assertDetailsMatchType(dto.type, dto.details);
    if (!dto.shipParticularId && !dto.nominationId)
      throw new BadRequestException('Select a vessel for the service');
    const branchId = actor ? await this.creationBranch(actor, dto.branchId) : undefined;
    const assignment = dto.shipParticularId
      ? await this.resolveVesselForUser(dto.shipParticularId, dto.nominationId, userId, branchId)
      : await this.resolveNominationForUser(dto.nominationId, userId, branchId);

    const created = await this.prisma.serviceRequest.create({
      data: {
        type: dto.type,
        shipParticularId: assignment.shipParticularId,
        branchId: assignment.branchId,
        nominationId: assignment.nominationId,
        supplierId: dto.supplierId ?? null,
        location: dto.location ?? null,
        originPoint:
          dto.originPoint ??
          (dto.details.type === 'LAUNCH' ? (dto.details.departurePoint ?? null) : null),
        destinationPoint: dto.destinationPoint ?? null,
        contactPersonName: dto.contactPersonName ?? null,
        operationDescription: dto.operationDescription ?? null,
        portId: dto.portId ?? null,
        pierId: dto.pierId ?? null,
        scheduledAt: dto.scheduledAt,
        completedAt: dto.completedAt ?? null,
        physicalVoucherNo: dto.physicalVoucherNo ?? null,
        notes: dto.notes ?? null,
        requestedByAuthority: dto.requestedByAuthority ?? false,
        requestingAuthority: dto.requestedByAuthority ? (dto.requestingAuthority ?? null) : null,
        supplierInvoiceNo: dto.supplierInvoiceNo ?? null,
        details: dto.details,
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

  async nominationOptions(userId: string, q = '', actor?: RequestUser) {
    const user = actor
      ? { branchId: this.listBranch(actor) }
      : await this.prisma.user.findUnique({
          where: { id: userId },
          select: { branchId: true },
        });
    if (!actor && !user?.branchId) return [];

    const search = q.trim().toLocaleLowerCase();
    const rows = await this.prisma.nomination.findMany({
      where: {
        ...(user?.branchId && { branchId: user.branchId }),
        status: { not: 'CANCELLED' },
      },
      select: {
        id: true,
        kind: true,
        correlative: true,
        businessReference: true,
        dateNominated: true,
        voyageNumber: true,
        shipParticularId: true,
        shipParticular: { select: { name: true } },
        branchId: true,
        branch: { select: { name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
      // Search the formatted reference before limiting results; otherwise a
      // matching older nomination can disappear behind the first 100 rows.
      ...(!search && { take: 100 }),
    });

    return rows
      .flatMap((row) => {
        const reference = resolveNominationReference(row);
        const label = `${reference} · ${row.shipParticular.name}`;
        if (
          search &&
          !label.toLocaleLowerCase().includes(search) &&
          !row.voyageNumber?.toLocaleLowerCase().includes(search)
        ) {
          return [];
        }
        return [
          {
            id: row.id,
            label,
            reference,
            shipParticularId: row.shipParticularId,
            vesselName: row.shipParticular.name,
            branchId: row.branchId ?? user?.branchId ?? null,
            branchName: row.branch?.name ?? '',
          },
        ];
      })
      .slice(0, 100);
  }

  async update(
    id: string,
    dto: ServiceRequestUpdate,
    userId?: string,
    actor?: RequestUser,
  ): Promise<ServiceRequestRead> {
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

    if (
      dto.shipParticularId !== undefined ||
      dto.nominationId !== undefined ||
      dto.branchId !== undefined
    ) {
      const vesselId =
        dto.shipParticularId === undefined ? existing.shipParticularId : dto.shipParticularId;
      const nominationId =
        dto.nominationId === undefined ? existing.nominationId : dto.nominationId;
      if (userId) {
        const branchId = actor
          ? await this.creationBranch(actor, dto.branchId ?? existing.branchId)
          : undefined;
        const assignment = vesselId
          ? await this.resolveVesselForUser(vesselId, nominationId, userId, branchId)
          : existing.type === 'GENERAL'
            ? await this.resolveAdministrationForUser(userId, branchId)
            : await this.resolveNominationForUser(nominationId, userId, branchId);
        dto = { ...dto, ...assignment };
      }
    }

    const updated = await this.prisma.serviceRequest
      .update({
        where: { id, status: existing.status, updatedAt: existing.updatedAt },
        data: {
          ...(dto.shipParticularId !== undefined && { shipParticularId: dto.shipParticularId }),
          ...(dto.branchId !== undefined && { branchId: dto.branchId }),
          ...(dto.nominationId !== undefined && { nominationId: dto.nominationId }),
          ...(dto.supplierId !== undefined && { supplierId: dto.supplierId }),
          ...(dto.location !== undefined && { location: dto.location }),
          ...(dto.originPoint !== undefined && { originPoint: dto.originPoint }),
          ...(dto.destinationPoint !== undefined && { destinationPoint: dto.destinationPoint }),
          ...(dto.contactPersonName !== undefined && { contactPersonName: dto.contactPersonName }),
          ...(dto.operationDescription !== undefined && {
            operationDescription: dto.operationDescription,
          }),
          ...(dto.portId !== undefined && { portId: dto.portId }),
          ...(dto.pierId !== undefined && { pierId: dto.pierId }),
          ...(dto.scheduledAt !== undefined && { scheduledAt: dto.scheduledAt }),
          ...(dto.completedAt !== undefined && { completedAt: dto.completedAt }),
          ...(dto.physicalVoucherNo !== undefined && { physicalVoucherNo: dto.physicalVoucherNo }),
          ...(dto.requestedByAuthority !== undefined && {
            requestedByAuthority: dto.requestedByAuthority,
          }),
          ...(dto.requestingAuthority !== undefined && {
            requestingAuthority: dto.requestingAuthority,
          }),
          ...(dto.supplierInvoiceNo !== undefined && { supplierInvoiceNo: dto.supplierInvoiceNo }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.reconciliationNotes !== undefined && {
            reconciliationNotes: dto.reconciliationNotes,
          }),
          ...(dto.details !== undefined && {
            details: dto.details,
          }),
          ...(dto.billToClientId !== undefined && { billToClientId: dto.billToClientId }),
          ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
          ...(dto.actualCost !== undefined && { actualCost: dto.actualCost }),
          ...(dto.currency !== undefined && { currency: dto.currency }),
          // Any draft save can change the terms the manager approved.
          ...(existing.approvedAt && { approvedById: null, approvedAt: null }),
          ...(existing.status === 'DRAFT' && { minioKey: null, pdfGeneratedAt: null }),
        },
        include: DETAIL_INCLUDE,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException('The request changed while saving; reload it and try again');
        }
        throw error;
      });
    if (existing.status === 'DRAFT' && existing.minioKey) {
      try {
        await this.storage.deleteFile(existing.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.pdf.invalidate.warn', id, err });
      }
    }
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

  async report(query: ServiceRequestListQuery, actor?: RequestUser) {
    const items: ServiceRequestListItem[] = [];
    let page = 1;
    let total = 0;
    do {
      const pageQuery = { ...query, page, pageSize: 100 };
      const result = actor ? await this.list(pageQuery, actor) : await this.list(pageQuery);
      items.push(...result.items);
      total = result.total;
      if (!result.items.length) break;
      page += 1;
    } while (items.length < total);
    return { items, total: items.length, page: 1, pageSize: Math.max(1, items.length) };
  }

  async list(
    query: ServiceRequestListQuery,
    actor?: RequestUser,
  ): Promise<ServiceRequestListResponse> {
    const branchId = actor ? this.listBranch(actor, query.branchId) : query.branchId;
    const where: Prisma.ServiceRequestWhereInput = {
      ...(query.type && { type: query.type }),
      ...(query.status && { status: query.status }),
      ...(query.shipParticularId && { shipParticularId: query.shipParticularId }),
      ...(branchId && { branchId }),
      ...(query.supplierId && { supplierId: query.supplierId }),
      ...(query.nominationId && { nominationId: query.nominationId }),
      ...((query.dateFrom || query.dateTo) && {
        scheduledAt: {
          ...(query.dateFrom && { gte: query.dateFrom }),
          ...(query.dateTo &&
            (query.dateTo.toISOString().endsWith('T00:00:00.000Z')
              ? { lt: new Date(query.dateTo.getTime() + 86400000) }
              : { lte: query.dateTo })),
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
      // A bare number, or the numeric part of "SN0007/26/PLC", matches the
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
          createdBy: { select: { email: true, displayName: true } },
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
      vesselName: row.shipParticular?.name ?? null,
      branchCode: row.branch.code,
      supplierName: row.supplier?.name ?? null,
      supplierId: row.supplierId,
      serviceLabel: resolveServiceLabel(row.details),
      location: row.location,
      scheduledAt: row.scheduledAt,
      physicalVoucherNo: row.physicalVoucherNo,
      supplierInvoiceNo: row.supplierInvoiceNo,
      actualCost: row.actualCost == null ? null : row.actualCost.toNumber(),
      currency: row.currency,
      sentAt: row.sentAt,
      requestedBy: row.createdBy.displayName?.trim() || row.createdBy.email,
    }));

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  // -------------------------------------------------------------------------
  // Authorisation documents
  // -------------------------------------------------------------------------

  async addDocuments(
    id: string,
    attachmentIds: string[],
    userId?: string,
  ): Promise<ServiceRequestRead> {
    const existing = await this.getOrThrow(id);
    if (existing.status === 'CANCELLED') {
      throw new ConflictException('Cannot add documents to a cancelled request');
    }
    if (userId) {
      const uniqueIds = [...new Set(attachmentIds)];
      const uploads = await this.prisma.emailAttachment.findMany({
        where: { id: { in: uniqueIds } },
        select: { id: true, uploadedById: true, serviceRequestId: true },
      });
      if (uploads.length !== uniqueIds.length) {
        throw new BadRequestException('One or more attachments no longer exist');
      }
      if (
        uploads.some(
          (upload) =>
            upload.serviceRequestId !== id &&
            (upload.serviceRequestId !== null || upload.uploadedById !== userId),
        )
      ) {
        throw new ForbiddenException('Only your own staged uploads can be added to this request.');
      }
    }
    await this.attachments.attachToServiceRequest(attachmentIds, id);
    await this.invalidateDraftOrder(existing);
    return this.toDto(await this.getOrThrow(id));
  }

  async removeDocument(id: string, attachmentId: string): Promise<ServiceRequestRead> {
    const existing = await this.getOrThrow(id);
    await this.attachments.removeFromServiceRequest(attachmentId, id);
    await this.invalidateDraftOrder(existing);
    return this.toDto(await this.getOrThrow(id));
  }

  async approve(id: string, userId: string, actor?: RequestUser): Promise<ServiceRequestRead> {
    const request = await this.getOrThrow(id);
    if (request.status !== 'DRAFT') throw new ConflictException('Only a draft can be approved');
    const readiness = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: request.supplierId,
      details: request.details,
      documentCount: request.documents.length,
      requestedByAuthority: request.requestedByAuthority,
      requestingAuthority: request.requestingAuthority,
    });
    if (!readiness.success) {
      throw new BadRequestException(
        readiness.error.issues.map((issue) => issue.message).join('; '),
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, operationalRole: true, branchId: true, isActive: true },
    });
    if (
      !user?.isActive ||
      (user.role !== 'ADM' &&
        (user.operationalRole !== 'BRANCH_MANAGER' ||
          (actor ? actor.branchId : user.branchId) !== request.branchId))
    ) {
      throw new ForbiddenException(
        'Only an active branch manager for this branch or an administrator can approve',
      );
    }
    const updated = await this.prisma.serviceRequest
      .update({
        where: { id, status: 'DRAFT', updatedAt: request.updatedAt },
        data: {
          approvedById: userId,
          approvedAt: new Date(),
          minioKey: null,
          pdfGeneratedAt: null,
        },
        include: DETAIL_INCLUDE,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException(
            'The request changed before approval; reload it and try again',
          );
        }
        throw error;
      });
    if (request.minioKey) {
      try {
        await this.storage.deleteFile(request.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.pdf.invalidate.warn', id, err });
      }
    }
    this.logger.log({ event: 'service-request.approved', id, userId });
    return this.toDto(updated);
  }

  async recordReceipt(
    id: string,
    dto: ServiceRequestReceipt,
    userId: string,
  ): Promise<ServiceRequestRead> {
    const request = await this.getOrThrow(id);
    if (request.status !== 'SENT' && request.status !== 'COMPLETED') {
      throw new ConflictException('A provider receipt can be recorded only after issue');
    }
    if (
      request.receivedAt &&
      (dto.receiptName !== request.receiptName ||
        (dto.receiptTitle ?? null) !== request.receiptTitle ||
        dto.receivedAt.getTime() !== request.receivedAt.getTime() ||
        (request.receiptAttachmentId !== null &&
          dto.receiptAttachmentId !== request.receiptAttachmentId))
    ) {
      throw new ConflictException(
        'A recorded receipt cannot be changed; only a missing signed scan may be attached',
      );
    }
    if (dto.receiptAttachmentId && dto.receiptAttachmentId !== request.receiptAttachmentId) {
      const attachment = await this.prisma.emailAttachment.findUnique({
        where: { id: dto.receiptAttachmentId },
        select: {
          emailDispatchId: true,
          shDocumentDispatchId: true,
          serviceRequestDispatchId: true,
          serviceRequestId: true,
          uploadedById: true,
          serviceRequestReceipt: { select: { id: true } },
        },
      });
      if (
        !attachment ||
        attachment.uploadedById !== userId ||
        attachment.emailDispatchId ||
        attachment.shDocumentDispatchId ||
        attachment.serviceRequestDispatchId ||
        attachment.serviceRequestId ||
        (attachment.serviceRequestReceipt && attachment.serviceRequestReceipt.id !== id)
      ) {
        throw new BadRequestException('Select an unused receipt scan uploaded for this request');
      }
    }
    const updated = await this.prisma.serviceRequest
      .update({
        where: { id, updatedAt: request.updatedAt, status: { in: ['SENT', 'COMPLETED'] } },
        data: {
          receiptName: dto.receiptName,
          receiptTitle: dto.receiptTitle ?? null,
          receivedAt: dto.receivedAt,
          ...(!request.receivedAt && {
            receiptRecordedById: userId,
            receiptRecordedAt: new Date(),
          }),
          ...(dto.receiptAttachmentId !== undefined && {
            receiptAttachmentId: dto.receiptAttachmentId,
          }),
        },
        include: DETAIL_INCLUDE,
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException(
            'The request changed before recording receipt; reload it and try again',
          );
        }
        throw error;
      });
    this.logger.log({
      event: 'service-request.receipt',
      id,
      receiptAttachmentId: dto.receiptAttachmentId ?? null,
    });
    return this.toDto(updated);
  }

  // -------------------------------------------------------------------------
  // Purchase order
  // -------------------------------------------------------------------------

  /**
   * Render the purchase order to MinIO and return its key. Idempotent — a
   * regenerate replaces the previous object, which matters while the operator
   * is still tweaking a draft.
   */
  async generateOrderPdf(
    id: string,
    forSend = false,
  ): Promise<{ minioKey: string; generatedUpdatedAt: Date }> {
    const request = await this.getOrThrow(id);
    if (request.status === 'CANCELLED') {
      throw new ConflictException('Cannot generate an order for a cancelled request');
    }
    if (request.status !== 'DRAFT' && !forSend) {
      throw new ConflictException('Issued orders can only be regenerated as part of a resend');
    }

    const readiness = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: request.supplierId,
      details: request.details,
      documentCount: request.documents.length,
      requestedByAuthority: request.requestedByAuthority,
      requestingAuthority: request.requestingAuthority,
    });
    if (!readiness.success)
      throw new BadRequestException(
        readiness.error.issues.map((issue) => issue.message).join('; '),
      );
    const buffer = await this.pdf.renderTemplate('orden-de-compra.hbs', buildOrderContext(request));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newKey = `service-requests/${id}/orden-de-compra-${timestamp}.pdf`;

    const oldPdfWasDispatched = request.minioKey
      ? (await this.prisma.serviceRequestDispatch.count({
          where: { pdfStorageKey: request.minioKey },
        })) > 0
      : false;
    await this.storage.uploadFile(newKey, buffer, 'application/pdf');
    let updated: { updatedAt: Date };
    try {
      updated = await this.prisma.serviceRequest.update({
        where: { id, status: request.status, updatedAt: request.updatedAt },
        data: { minioKey: newKey, pdfGeneratedAt: new Date() },
        select: { updatedAt: true },
      });
    } catch (error) {
      try {
        await this.storage.deleteFile(newKey);
      } catch (cleanupError) {
        this.logger.warn({ event: 'service-request.pdf.cleanup.warn', id, err: cleanupError });
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new ConflictException(
          'The request changed while generating the order; reload it and try again',
        );
      }
      throw error;
    }
    if (request.minioKey && !oldPdfWasDispatched) {
      try {
        await this.storage.deleteFile(request.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.pdf.replace.warn', id, err });
      }
    }
    return { minioKey: newKey, generatedUpdatedAt: updated.updatedAt };
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

  async downloadDispatchOrder(
    id: string,
    dispatchId: string,
    format: 'pdf' | 'docx',
  ): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.getOrThrow(id);
    const dispatch = await this.prisma.serviceRequestDispatch.findFirst({
      where: { id: dispatchId, serviceRequestId: id },
      select: { pdfStorageKey: true, docxStorageKey: true },
    });
    if (!dispatch) throw new NotFoundException('Order dispatch not found');
    const key = format === 'pdf' ? dispatch.pdfStorageKey : dispatch.docxStorageKey;
    if (!key) throw new ConflictException('This dispatch has no archived Word copy');
    const control = formatControlNumber(
      request.correlative,
      request.createdAt,
      request.branch.code,
    );
    return {
      buffer: await this.storage.getFileBuffer(key),
      filename: `OC-${control.replace(/\//g, '-')}-${dispatchId}.${format}`,
    };
  }

  /** Drafts preview live values; issued orders return the stored Word copy. */
  async downloadOperationalOrderDocx(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const request = await this.getOrThrow(id);
    const control = formatControlNumber(
      request.correlative,
      request.createdAt,
      request.branch.code,
    );
    if (request.status !== 'DRAFT' && !request.issuedDocxKey) {
      throw new ConflictException(
        'This older issued order has no archived Word copy; use its issued PDF',
      );
    }
    return {
      buffer:
        request.status === 'DRAFT'
          ? this.operationalOrderDocx.render(buildOperationalOrderData(request))
          : await this.storage.getFileBuffer(request.issuedDocxKey!),
      filename: `OC-${control.replace(/\//g, '-')}.docx`,
    };
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
  ): Promise<{
    request: ServiceRequestRead;
    dispatch: {
      id: string;
      sentAt: string | null;
      subject: string;
      toAddresses: string[];
      ccAddresses: string[];
      bodyHtml: string | null;
    };
  }> {
    let request = await this.getOrThrow(id);

    if (request.status === 'CANCELLED') {
      throw new ConflictException('Cannot send a cancelled request');
    }

    // Golden Rule 5 — the readiness rules the Review step showed the operator
    // are re-checked here, because the frontend check is advisory only.
    const readiness = ServiceRequestSendReadinessSchema.safeParse({
      supplierId: request.supplierId,
      details: request.details,
      documentCount: request.documents.length,
      requestedByAuthority: request.requestedByAuthority,
      requestingAuthority: request.requestingAuthority,
    });
    if (!readiness.success) {
      throw new BadRequestException(
        readiness.error.issues.map((issue) => issue.message).join('; '),
      );
    }

    // Validate attachments before generating archived files.
    const extraAttachments = await this.attachments.resolveForSend(dto.attachmentIds ?? []);
    const requestDocuments = await this.attachments.resolveServiceRequestDocuments(id);

    // Regenerate rather than reuse: the operator may have edited the request
    // since the last preview, and the provider must receive what is on screen.
    const { minioKey, generatedUpdatedAt } = await this.generateOrderPdf(id, true);
    request = await this.getOrThrow(id);
    if (request.updatedAt.getTime() !== generatedUpdatedAt.getTime()) {
      throw new ConflictException(
        'The request changed while generating the order; reload it and try again',
      );
    }
    const issuer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true },
    });
    if (!issuer) throw new NotFoundException('Issuing user no longer exists');
    const issueAt = new Date();
    const wordBuffer = this.operationalOrderDocx.render(
      buildOperationalOrderData(request, {
        name: issuer.displayName?.trim() || issuer.email,
        at: issueAt,
      }),
    );
    const docxStorageKey = `service-requests/${id}/orden-operativa-${issueAt.toISOString().replace(/[:.]/g, '-')}-${randomUUID()}.docx`;
    await this.storage.uploadFile(
      docxStorageKey,
      wordBuffer,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );

    const control = formatControlNumber(
      request.correlative,
      request.createdAt,
      request.branch.code,
    );
    const subject =
      dto.subject ??
      `Purchase Order ${control} — ${request.shipParticular?.name ?? 'Administration'} — ${resolveServiceLabel(request.details)}`;

    const bodyHtml = dto.bodyText ? wrapPlainTextEmailBody(dto.bodyText) : null;
    const ccAddresses = appendBranchCc(dto.ccAddresses, request.branch);

    const { dispatch } = await this.prisma
      .$transaction(async (tx) => {
        const dispatch = await tx.serviceRequestDispatch.create({
          data: {
            serviceRequestId: id,
            toAddresses: dto.toAddresses,
            ccAddresses,
            bccAddresses: dto.bccAddresses,
            subject,
            bodyHtml,
            pdfStorageKey: minioKey,
            docxStorageKey,
            sentById: userId,
            sentAt: null,
            error: null,
          },
        });
        await tx.serviceRequest.update({
          where: { id, status: request.status, updatedAt: generatedUpdatedAt },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            // Snapshot where the order went, so a later edit of the supplier's
            // contact list cannot rewrite history.
            providerEmails: dto.toAddresses,
            issuedDocxKey: docxStorageKey,
            issuedById: userId,
            issuedAt: issueAt,
          },
        });
        return { dispatch };
      })
      .catch(async (error: unknown) => {
        try {
          await this.storage.deleteFile(docxStorageKey);
        } catch (cleanupError) {
          this.logger.warn({ event: 'service-request.docx.cleanup.warn', id, err: cleanupError });
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException(
            'The request changed before dispatch; reload it and try again',
          );
        }
        throw error;
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
      await this.attachments.linkToServiceRequestDispatch(
        [...(dto.attachmentIds ?? []), ...request.documents.map((file) => file.id)],
        dispatch.id,
      );
      await this.email.send({
        to: dto.toAddresses,
        cc: ccAddresses,
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
      this.logger.log({ event: 'service-request.sent', id, control, dispatchId: dispatch.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.serviceRequestDispatch.update({
        where: { id: dispatch.id },
        data: { error: message },
      });
      this.logger.error({ event: 'service-request.send.failed', id, err: message });
      throw err; // Delivery may be uncertain; the durable claim prevents a duplicate retry.
    }

    return {
      request: this.toDto(await this.getOrThrow(id)),
      dispatch: {
        id: dispatch.id,
        sentAt: sentAt?.toISOString() ?? null,
        subject: dispatch.subject,
        toAddresses: dispatch.toAddresses,
        ccAddresses: dispatch.ccAddresses,
        bodyHtml: dispatch.bodyHtml,
      },
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
      hasWord: row.docxStorageKey != null,
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

  private async invalidateDraftOrder(request: ServiceRequestWithRelations): Promise<void> {
    if (request.status !== 'DRAFT') return;
    await this.prisma.serviceRequest
      .update({
        where: { id: request.id, status: 'DRAFT', updatedAt: request.updatedAt },
        data: { approvedById: null, approvedAt: null, minioKey: null, pdfGeneratedAt: null },
      })
      .catch((error: unknown) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
          throw new ConflictException(
            'The request changed while filing documents; reload it and try again',
          );
        }
        throw error;
      });
    if (request.minioKey) {
      try {
        await this.storage.deleteFile(request.minioKey);
      } catch (err) {
        this.logger.warn({ event: 'service-request.pdf.invalidate.warn', id: request.id, err });
      }
    }
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
      branch: { id: row.branch.id, name: row.branch.name, code: row.branch.code },
      nominationId: row.nominationId,
      supplierId: row.supplierId,
      supplier: row.supplier,
      providerEmails: row.providerEmails,

      location: row.location,
      originPoint:
        row.originPoint ??
        (row.details &&
        typeof row.details === 'object' &&
        !Array.isArray(row.details) &&
        'departurePoint' in row.details &&
        typeof row.details.departurePoint === 'string'
          ? row.details.departurePoint
          : null),
      destinationPoint: row.destinationPoint,
      contactPersonName: row.contactPersonName,
      operationDescription: row.operationDescription,
      portId: row.portId,
      port: row.port,
      pierId: row.pierId,
      pier: row.pier,

      scheduledAt: row.scheduledAt,
      completedAt: row.completedAt,
      physicalVoucherNo: row.physicalVoucherNo,
      notes: row.notes,
      reconciliationNotes: row.reconciliationNotes,
      requestedByAuthority: row.requestedByAuthority,
      requestingAuthority: row.requestingAuthority,
      supplierInvoiceNo: row.supplierInvoiceNo,
      // Parsed rather than passed through, so defaults added to the union since
      // the row was written (a new checklist flag, say) are filled in on read.
      details: ServiceRequestDetailsSchema.parse(row.details),

      billToClientId: row.billToClientId,
      billToClient: row.billToClient,
      estimatedCost: row.estimatedCost == null ? null : row.estimatedCost.toNumber(),
      actualCost: row.actualCost == null ? null : row.actualCost.toNumber(),
      currency: row.currency,

      authorizationRequired: requiresAuthorizationDocument(row.details, row.requestedByAuthority),
      documents: row.documents,

      minioKey: row.minioKey,
      issuedDocxKey: row.issuedDocxKey,
      approvedBy: row.approvedBy,
      approvedAt: row.approvedAt,
      issuedBy: row.issuedBy,
      issuedAt: row.issuedAt,
      receiptName: row.receiptName,
      receiptTitle: row.receiptTitle,
      receivedAt: row.receivedAt,
      receiptRecordedBy: row.receiptRecordedBy,
      receiptRecordedAt: row.receiptRecordedAt,
      receiptAttachment: row.receiptAttachment,
      pdfGeneratedAt: row.pdfGeneratedAt,
      sentAt: row.sentAt,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,

      createdBy: row.createdBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async resolveNominationForUser(
    nominationId: string | null,
    userId: string,
    selectedBranchId?: string,
  ): Promise<{ nominationId: string; shipParticularId: string; branchId: string }> {
    const user = selectedBranchId
      ? { branchId: selectedBranchId }
      : await this.prisma.user.findUnique({
          where: { id: userId },
          select: { branchId: true },
        });
    if (!user?.branchId) {
      throw new BadRequestException('Your user is not assigned to a branch');
    }
    if (!nominationId) {
      throw new BadRequestException('Select an active SN/OT nomination from your branch');
    }
    const nomination = await this.prisma.nomination.findFirst({
      where: { id: nominationId, branchId: user.branchId, status: { not: 'CANCELLED' } },
      select: { id: true, shipParticularId: true, branchId: true },
    });
    if (!nomination?.branchId) {
      throw new BadRequestException('Select an active SN/OT nomination from your branch');
    }
    return {
      nominationId: nomination.id,
      shipParticularId: nomination.shipParticularId,
      branchId: nomination.branchId,
    };
  }

  private async resolveVesselForUser(
    shipParticularId: string,
    nominationId: string | null,
    userId: string,
    selectedBranchId?: string,
  ) {
    const assignment = await this.resolveAdministrationForUser(userId, selectedBranchId);
    const vessel = await this.prisma.shipParticular.findUnique({
      where: { id: shipParticularId },
      select: { id: true },
    });
    if (!vessel) throw new BadRequestException('Select a registered vessel');
    if (nominationId) {
      const nomination = await this.resolveNominationForUser(
        nominationId,
        userId,
        selectedBranchId,
      );
      if (nomination.shipParticularId !== shipParticularId)
        throw new BadRequestException('The nomination belongs to another vessel');
    }
    return { branchId: assignment.branchId, shipParticularId, nominationId };
  }

  private async resolveAdministrationForUser(
    userId: string,
    selectedBranchId?: string,
  ): Promise<{
    shipParticularId: null;
    branchId: string;
    nominationId: null;
  }> {
    const user = selectedBranchId
      ? { branchId: selectedBranchId }
      : await this.prisma.user.findUnique({
          where: { id: userId },
          select: { branchId: true },
        });
    if (!user?.branchId) throw new BadRequestException('Your user is not assigned to a branch');
    return { shipParticularId: null, branchId: user.branchId, nominationId: null };
  }

  /** RequestUser comes from the strategy's current account and authorized selected branch. */
  private listBranch(actor: RequestUser, requestedBranchId?: string): string | undefined {
    if (!hasManagementAccess(actor) && !actor.branchId) {
      throw new ForbiddenException('An authorized branch assignment is required.');
    }
    if (actor.branchId) {
      if (requestedBranchId && requestedBranchId !== actor.branchId) {
        throw new ForbiddenException('Switch to the requested branch before viewing its requests.');
      }
      return actor.branchId;
    }
    return requestedBranchId;
  }

  private async creationBranch(actor: RequestUser, requestedBranchId?: string): Promise<string> {
    if (!hasManagementAccess(actor)) return this.listBranch(actor, requestedBranchId)!;
    const branchId = requestedBranchId ?? actor.branchId;
    if (!branchId) throw new BadRequestException('Select a branch for this service request.');
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch)
      throw new BadRequestException('Select an existing branch for this service request.');
    return branchId;
  }
}
