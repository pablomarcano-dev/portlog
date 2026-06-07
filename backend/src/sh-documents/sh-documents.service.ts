import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EmailService } from '../email/email.service.js';
import {
  type CreateSHDocumentInput,
  type UpdateSHDocumentInput,
  type SendShDocumentInput,
  type SHDocumentDto,
} from '@portlog/schemas';

const TEMPLATE_MAP: Record<string, string> = {
  SH_66A: 'sh-66a.hbs',
  SH_09A: 'sh-09a.hbs',
  SH_28A: 'sh-28a.hbs',
  SH_29A: 'sh-29a.hbs',
};

@Injectable()
export class SHDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
    private readonly email: EmailService,
  ) {}

  async create(
    nominationId: string,
    dto: CreateSHDocumentInput,
    userId: string,
  ): Promise<SHDocumentDto> {
    await this.assertNominationExists(nominationId);
    const doc = await this.prisma.sHDocument.create({
      data: {
        nominationId,
        type: dto.type,
        title: dto.title ?? null,
        data: dto.data ?? {},
        createdById: userId,
      },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    return this.toDto(doc);
  }

  async list(nominationId: string): Promise<SHDocumentDto[]> {
    await this.assertNominationExists(nominationId);
    const docs = await this.prisma.sHDocument.findMany({
      where: { nominationId },
      include: { createdBy: { select: { id: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return docs.map((d) => this.toDto(d));
  }

  async findOne(nominationId: string, shId: string): Promise<SHDocumentDto> {
    const doc = await this.prisma.sHDocument.findFirst({
      where: { id: shId, nominationId },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!doc) throw new NotFoundException(`SHDocument ${shId} not found`);
    return this.toDto(doc);
  }

  async update(
    nominationId: string,
    shId: string,
    dto: UpdateSHDocumentInput,
  ): Promise<SHDocumentDto> {
    const doc = await this.getOrThrow(nominationId, shId);
    if (doc.status === 'SENT') throw new ConflictException('Document has been sent — read-only');
    if (doc.status === 'FINALIZED')
      throw new ForbiddenException('Finalized documents cannot be edited');
    const updated = await this.prisma.sHDocument.update({
      where: { id: shId },
      data: {
        title: dto.title !== undefined ? dto.title : doc.title,
        data: dto.data,
      },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    return this.toDto(updated);
  }

  async finalize(nominationId: string, shId: string): Promise<SHDocumentDto> {
    const doc = await this.getOrThrow(nominationId, shId);
    if (doc.status === 'SENT') throw new ConflictException('Document has been sent — read-only');
    if (doc.status === 'FINALIZED') throw new ConflictException('Already finalized');
    if (doc.type === 'COMMENT' || doc.type === 'OTHER') {
      throw new BadRequestException(`${doc.type} documents cannot be finalized`);
    }
    this.validateDataForFinalize(doc.type, doc.data);
    const updated = await this.prisma.sHDocument.update({
      where: { id: shId },
      data: { status: 'FINALIZED' },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    return this.toDto(updated);
  }

  async generatePdf(
    nominationId: string,
    shId: string,
  ): Promise<{ minioKey: string; downloadUrl: string }> {
    const doc = await this.getOrThrow(nominationId, shId);
    if (doc.status === 'SENT') throw new ConflictException('Document has been sent — read-only');
    if (doc.type === 'COMMENT' || doc.type === 'OTHER') {
      throw new BadRequestException(`${doc.type} documents do not support PDF generation`);
    }

    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      include: { shipParticular: true, opPort: true },
    });

    const context = {
      nomination: {
        correlative: nomination?.correlative?.toString() ?? '',
        vesselName: nomination?.shipParticular?.name ?? null,
        imo: nomination?.shipParticular?.imoNumber ?? null,
        voyageNumber: nomination?.voyageNumber ?? null,
        opPortName: (nomination?.opPort as { name?: string } | null)?.name ?? null,
        etaDate: nomination?.etaDate?.toISOString() ?? null,
      },
      doc: doc.data,
    };

    const buffer = await this.pdf.renderTemplate(TEMPLATE_MAP[doc.type]!, context);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newKey = `sgc-documents/${nominationId}/sh-xx/${doc.type.toLowerCase()}-${timestamp}.pdf`;

    if (doc.minioKey) {
      try {
        await this.storage.deleteFile(doc.minioKey);
      } catch {
        /* ignore */
      }
    }

    await this.storage.uploadFile(newKey, buffer, 'application/pdf');
    await this.prisma.sHDocument.update({
      where: { id: shId },
      data: { minioKey: newKey, pdfGeneratedAt: new Date() },
    });

    const downloadUrl = await this.storage.getPresignedUrl(newKey, 3600);
    return { minioKey: newKey, downloadUrl };
  }

  async getPdfUrl(nominationId: string, shId: string): Promise<{ url: string; expiresAt: string }> {
    const doc = await this.getOrThrow(nominationId, shId);
    if (!doc.minioKey) throw new BadRequestException('No PDF generated yet');
    const url = await this.storage.getPresignedUrl(doc.minioKey, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    return { url, expiresAt };
  }

  async delete(nominationId: string, shId: string): Promise<void> {
    const doc = await this.getOrThrow(nominationId, shId);
    if (doc.status !== 'DRAFT') throw new ConflictException('Only DRAFT documents can be deleted');
    if (doc.minioKey) {
      try {
        await this.storage.deleteFile(doc.minioKey);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.sHDocument.delete({ where: { id: shId } });
  }

  async send(
    nominationId: string,
    shId: string,
    dto: SendShDocumentInput,
    userId: string,
  ): Promise<{ shDocument: SHDocumentDto; dispatch: { id: string; sentAt: string | null } }> {
    // --- Validate document ---
    const doc = await this.getOrThrow(nominationId, shId);
    if (doc.status !== 'FINALIZED') {
      throw new ConflictException('Only FINALIZED documents can be dispatched via email');
    }
    if (doc.type === 'COMMENT' || doc.type === 'OTHER') {
      throw new BadRequestException(`${doc.type} documents cannot be dispatched`);
    }
    if (!doc.minioKey) {
      throw new BadRequestException('Document has no PDF — generate it first');
    }

    // --- Build default subject from nomination ---
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: { correlative: true },
    });
    const subject = dto.subject ?? `${doc.type} — ${nomination?.correlative ?? nominationId}`;

    // --- Tx 1: record dispatch (pending) + flip doc status to SENT ---
    // IMPORTANT: Status flip to SENT happens BEFORE email send. If SMTP fails,
    // status stays SENT and the dispatch row records the error. Operators must
    // inspect the dispatch error and re-send manually. This is intentional —
    // we do NOT roll back to FINALIZED on email failure.
    const { dispatch, updatedDoc } = await this.prisma.$transaction(async (tx) => {
      const dispatch = await tx.shDocumentDispatch.create({
        data: {
          shDocumentId: shId,
          toAddresses: dto.toAddresses,
          ccAddresses: dto.ccAddresses ?? [],
          subject,
          bodyHtml: dto.bodyHtml ?? null,
          pdfStorageKey: doc.minioKey!,
          sentById: userId,
          sentAt: null,
          error: null,
        },
      });
      const updatedDoc = await tx.sHDocument.update({
        where: { id: shId },
        data: { status: 'SENT', sentAt: new Date() },
        include: { createdBy: { select: { id: true, email: true } } },
      });
      return { dispatch, updatedDoc };
    });

    // --- Read PDF buffer from MinIO ---
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.storage.getFileBuffer(doc.minioKey);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.shDocumentDispatch.update({
        where: { id: dispatch.id },
        data: { error: `Failed to read PDF from storage: ${message}` },
      });
      throw new InternalServerErrorException('Failed to read PDF from storage');
    }

    // --- Send email; update dispatch row with result ---
    let sentAt: Date | null = null;
    try {
      await this.email.send({
        to: dto.toAddresses,
        cc: dto.ccAddresses ?? [],
        subject,
        html: dto.bodyHtml ?? '',
        attachments: [
          {
            filename: `${doc.type}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });
      sentAt = new Date();
      await this.prisma.shDocumentDispatch.update({
        where: { id: dispatch.id },
        data: { sentAt },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.shDocumentDispatch.update({
        where: { id: dispatch.id },
        data: { error: message },
      });
      // Status is already SENT — do not revert. Operator must re-dispatch manually.
    }

    return {
      shDocument: this.toDto(updatedDoc),
      dispatch: { id: dispatch.id, sentAt: sentAt?.toISOString() ?? null },
    };
  }

  markSent(shId: string): Promise<void> {
    return this.prisma.sHDocument
      .update({ where: { id: shId }, data: { status: 'SENT', sentAt: new Date() } })
      .then(() => undefined);
  }

  private async getOrThrow(nominationId: string, shId: string) {
    const doc = await this.prisma.sHDocument.findFirst({
      where: { id: shId, nominationId },
      include: { createdBy: { select: { id: true, email: true } } },
    });
    if (!doc) throw new NotFoundException(`SHDocument ${shId} not found`);
    return doc;
  }

  private async assertNominationExists(nominationId: string): Promise<void> {
    const n = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: { id: true },
    });
    if (!n) throw new NotFoundException(`Nomination ${nominationId} not found`);
  }

  private validateDataForFinalize(type: string, data: unknown): void {
    const d = data as Record<string, unknown>;
    if (type === 'SH_66A') {
      const rows = d['rows'] as unknown[];
      if (!Array.isArray(rows) || rows.length === 0)
        throw new BadRequestException('SH-66A requires at least one overtime row');
    }
    if (type === 'SH_09A') {
      if (!d['patientName'] || !d['body'])
        throw new BadRequestException('SH-09A requires patientName and body');
    }
    if (type === 'SH_28A' || type === 'SH_29A') {
      const rows = d['rows'] as unknown[];
      if (!Array.isArray(rows) || rows.length === 0)
        throw new BadRequestException(`${type} requires at least one spare parts row`);
    }
  }

  private toDto(doc: {
    id: string;
    nominationId: string;
    type: string;
    status: string;
    title: string | null;
    data: unknown;
    minioKey: string | null;
    pdfGeneratedAt: Date | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; email: string };
  }): SHDocumentDto {
    return {
      id: doc.id,
      nominationId: doc.nominationId,
      type: doc.type as SHDocumentDto['type'],
      status: doc.status as SHDocumentDto['status'],
      title: doc.title,
      data: doc.data,
      minioKey: doc.minioKey,
      pdfGeneratedAt: doc.pdfGeneratedAt?.toISOString() ?? null,
      sentAt: doc.sentAt?.toISOString() ?? null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
      createdBy: doc.createdBy,
    };
  }
}
