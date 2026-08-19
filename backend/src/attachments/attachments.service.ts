import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  MAX_ATTACHMENT_SIZE_BYTES,
  MAX_TOTAL_ATTACHMENTS_BYTES,
  isAllowedAttachmentMimeType,
  type AttachmentUploadResponse,
} from '@portlog/schemas';

/** An attachment resolved to an email-ready buffer (matches EmailService's shape). */
export interface ResolvedAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

const MB = 1024 * 1024;

@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Store an uploaded file in MinIO and record a "staged" EmailAttachment row
   * (no dispatch link yet). Validates MIME type and size authoritatively — the
   * client pre-validates too, but the server is the source of truth.
   */
  async upload(
    file: { filename: string; mimeType: string; buffer: Buffer },
    userId: string,
  ): Promise<AttachmentUploadResponse> {
    const filename = sanitizeFilename(file.filename);
    if (!filename) throw new BadRequestException('Missing or invalid filename');

    if (!isAllowedAttachmentMimeType(file.mimeType)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimeType}`);
    }

    const sizeBytes = file.buffer.length;
    if (sizeBytes === 0) throw new BadRequestException('Empty file');
    if (sizeBytes > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `File exceeds the ${Math.round(MAX_ATTACHMENT_SIZE_BYTES / MB)} MB limit`,
      );
    }

    // Random folder prevents key collisions and keeps original filenames intact.
    const key = `email-attachments/${randomUUID()}/${filename}`;
    await this.storage.uploadFile(key, file.buffer, file.mimeType);

    const row = await this.prisma.emailAttachment.create({
      data: {
        minioKey: key,
        filename,
        mimeType: file.mimeType,
        sizeBytes,
        uploadedById: userId,
      },
    });

    this.logger.log({ event: 'attachment.upload', id: row.id, filename, sizeBytes, userId });

    return {
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /**
   * Delete a *staged* attachment (not yet linked to a dispatch). Once an
   * attachment has been sent it is part of the append-only audit record and
   * cannot be removed.
   */
  async delete(id: string, userId: string): Promise<void> {
    const row = await this.prisma.emailAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attachment not found');
    if (row.emailDispatchId || row.shDocumentDispatchId || row.serviceRequestDispatchId) {
      throw new ConflictException('Attachment has already been sent and cannot be deleted');
    }
    // A file filed against a service request is that request's document, not a
    // staged upload — it is removed through the request's own endpoint so the
    // ownership check runs.
    if (row.serviceRequestId) {
      throw new ConflictException(
        'Attachment belongs to a service request — delete it from that request',
      );
    }

    // Best-effort object removal; the row delete is authoritative.
    try {
      await this.storage.deleteFile(row.minioKey);
    } catch (err) {
      this.logger.warn({ event: 'attachment.delete.storage.warn', id, err });
    }
    await this.prisma.emailAttachment.delete({ where: { id } });
    this.logger.log({ event: 'attachment.delete', id, userId });
  }

  /** Fetch an attachment's bytes for authenticated download/preview. */
  async getForDownload(id: string): Promise<ResolvedAttachment> {
    const row = await this.prisma.emailAttachment.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Attachment not found');
    const content = await this.storage.getFileBuffer(row.minioKey);
    return { filename: row.filename, content, contentType: row.mimeType };
  }

  /**
   * Resolve uploaded attachment IDs into email-ready buffers. Validates that
   * every id exists and that the combined size stays within the per-email cap.
   * Preserves caller order and de-duplicates. Returns [] for an empty list.
   */
  async resolveForSend(ids: string[]): Promise<ResolvedAttachment[]> {
    if (!ids.length) return [];
    const uniqueIds = [...new Set(ids)];

    const rows = await this.prisma.emailAttachment.findMany({
      where: { id: { in: uniqueIds } },
    });
    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('One or more attachments no longer exist');
    }

    const totalBytes = rows.reduce((sum, r) => sum + r.sizeBytes, 0);
    if (totalBytes > MAX_TOTAL_ATTACHMENTS_BYTES) {
      throw new PayloadTooLargeException(
        `Attachments exceed the ${Math.round(MAX_TOTAL_ATTACHMENTS_BYTES / MB)} MB total limit`,
      );
    }

    const byId = new Map(rows.map((r) => [r.id, r]));
    const resolved: ResolvedAttachment[] = [];
    for (const id of uniqueIds) {
      const row = byId.get(id)!;
      const content = await this.storage.getFileBuffer(row.minioKey);
      resolved.push({ filename: row.filename, content, contentType: row.mimeType });
    }
    return resolved;
  }

  /** Link staged attachments to a PEDR/nomination EmailDispatch after send. */
  async linkToEmailDispatch(ids: string[], emailDispatchId: string): Promise<void> {
    if (!ids.length) return;
    await this.prisma.emailAttachment.updateMany({
      where: { id: { in: [...new Set(ids)] } },
      data: { emailDispatchId },
    });
  }

  /** Link staged attachments to a SH-document dispatch after send. */
  async linkToShDocumentDispatch(ids: string[], shDocumentDispatchId: string): Promise<void> {
    if (!ids.length) return;
    await this.prisma.emailAttachment.updateMany({
      where: { id: { in: [...new Set(ids)] } },
      data: { shDocumentDispatchId },
    });
  }

  /** Link staged attachments to a service-request dispatch after send. */
  async linkToServiceRequestDispatch(
    ids: string[],
    serviceRequestDispatchId: string,
  ): Promise<void> {
    if (!ids.length) return;
    await this.prisma.emailAttachment.updateMany({
      where: { id: { in: [...new Set(ids)] } },
      data: { serviceRequestDispatchId },
    });
  }

  /**
   * Attach a staged upload to a service request as one of its own documents —
   * the `Carga de Autorización` (Capitanía letter) and any supporting scans.
   *
   * Unlike the dispatch links above this is not a send-time consumption: the
   * file belongs to the request for its whole life and is re-attached to every
   * Orden de Compra resend. Rejects a file that has already gone out on an
   * email, since that row is part of an append-only audit record.
   */
  async attachToServiceRequest(ids: string[], serviceRequestId: string): Promise<void> {
    if (!ids.length) return;
    const uniqueIds = [...new Set(ids)];

    const rows = await this.prisma.emailAttachment.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        emailDispatchId: true,
        shDocumentDispatchId: true,
        serviceRequestDispatchId: true,
        serviceRequestId: true,
      },
    });
    if (rows.length !== uniqueIds.length) {
      throw new BadRequestException('One or more attachments no longer exist');
    }
    for (const row of rows) {
      const alreadySent =
        row.emailDispatchId || row.shDocumentDispatchId || row.serviceRequestDispatchId;
      if (alreadySent) {
        throw new ConflictException('Attachment has already been sent and cannot be re-filed');
      }
      if (row.serviceRequestId && row.serviceRequestId !== serviceRequestId) {
        throw new ConflictException('Attachment already belongs to another service request');
      }
    }

    await this.prisma.emailAttachment.updateMany({
      where: { id: { in: uniqueIds } },
      data: { serviceRequestId },
    });
  }

  /**
   * Detach and delete one of a service request's own documents. Guarded the
   * same way as `delete`: once the file has ridden out on an OC it is audit
   * evidence and stays put.
   */
  async removeFromServiceRequest(id: string, serviceRequestId: string): Promise<void> {
    const row = await this.prisma.emailAttachment.findUnique({ where: { id } });
    if (!row || row.serviceRequestId !== serviceRequestId) {
      throw new NotFoundException('Attachment not found on this service request');
    }
    if (row.emailDispatchId || row.shDocumentDispatchId || row.serviceRequestDispatchId) {
      throw new ConflictException('Attachment has already been sent and cannot be deleted');
    }
    try {
      await this.storage.deleteFile(row.minioKey);
    } catch (err) {
      this.logger.warn({ event: 'attachment.delete.storage.warn', id, err });
    }
    await this.prisma.emailAttachment.delete({ where: { id } });
  }

  /** The request's own documents, oldest first, as email-ready buffers. */
  async resolveServiceRequestDocuments(serviceRequestId: string): Promise<ResolvedAttachment[]> {
    const rows = await this.prisma.emailAttachment.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'asc' },
    });
    const resolved: ResolvedAttachment[] = [];
    for (const row of rows) {
      const content = await this.storage.getFileBuffer(row.minioKey);
      resolved.push({ filename: row.filename, content, contentType: row.mimeType });
    }
    return resolved;
  }
}

/**
 * Strip directory components and non-printable control characters, then cap
 * length. Avoids a control-character regex (keeps the linter happy) by
 * filtering on char codes.
 */
function sanitizeFilename(name: string): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? '';
  let out = '';
  for (const ch of base) {
    if (ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) !== 127) out += ch;
  }
  return out.trim().slice(0, 255);
}
