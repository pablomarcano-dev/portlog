import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { PdfService } from '../pdf/pdf.service.js';

const fileSelect = { id: true, filename: true, mimeType: true, sizeBytes: true } as const;
const recapTypes = new Set(['ETA_REQUEST', 'ETA_TERMINAL', 'ETA_REPLY', 'ETA_ETB', 'NOR']);
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );

@Injectable()
export class NominationFilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly attachments: AttachmentsService,
    private readonly pdf: PdfService,
  ) {}

  async terminalFiles(portId: string) {
    if (!(await this.prisma.port.findUnique({ where: { id: portId }, select: { id: true } })))
      throw new NotFoundException('Terminal not found');
    return this.prisma.emailAttachment.findMany({
      where: { terminalPortId: portId, terminalRetiredAt: null },
      select: fileSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async fileAtTerminal(portId: string, attachmentId: string, userId: string) {
    await this.terminalFiles(portId);
    // Conditional update prevents taking an already-filed/sent record, even if
    // another request files the upload after this request starts.
    const result = await this.prisma.emailAttachment.updateMany({
      where: {
        id: attachmentId,
        uploadedById: userId,
        terminalPortId: null,
        serviceRequestId: null,
        emailDispatchId: null,
        shDocumentDispatchId: null,
        serviceRequestDispatchId: null,
        serviceRequestReceipt: { is: null },
      },
      data: { terminalPortId: portId },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Select your own unsent upload; existing documents cannot be moved',
      );
    return this.terminalFiles(portId);
  }

  async retireTerminalFile(portId: string, id: string) {
    const result = await this.prisma.emailAttachment.updateMany({
      where: { id, terminalPortId: portId, terminalRetiredAt: null },
      data: { terminalRetiredAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('Active terminal document not found');
    return this.terminalFiles(portId);
  }

  async prearrivalFiles(nominationId: string) {
    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: { opPort: { select: { id: true, name: true } } },
    });
    if (!nomination) throw new NotFoundException('Nomination not found');
    return {
      terminal: nomination.opPort,
      files: nomination.opPort ? await this.terminalFiles(nomination.opPort.id) : [],
    };
  }

  private async records(nominationId: string) {
    if (
      !(await this.prisma.nomination.findUnique({
        where: { id: nominationId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Nomination not found');
    const include = { attachments: { select: fileSelect } } as const;
    const [pedr, sh] = await Promise.all([
      this.prisma.emailDispatch.findMany({
        where: { pedr: { nominationId }, sentAt: { not: null } },
        include,
        orderBy: { sentAt: 'desc' },
      }),
      this.prisma.shDocumentDispatch.findMany({
        where: { shDocument: { nominationId }, sentAt: { not: null } },
        include: { ...include, shDocument: { select: { type: true } } },
        orderBy: { sentAt: 'desc' },
      }),
    ]);
    return [
      ...pedr.map((d) => ({ ...d, source: 'PEDR_DISPATCH', type: d.subDocType })),
      ...sh.map((d) => ({ ...d, source: 'SH_DISPATCH', type: d.shDocument.type })),
    ]
      .filter((d) => recapTypes.has(d.type))
      .sort((a, b) => b.sentAt!.getTime() - a.sentAt!.getTime());
  }

  async recapFiles(nominationId: string) {
    return (await this.records(nominationId)).map((d) => ({
      id: d.id,
      source: d.source,
      type: d.type,
      subject: d.subject,
      sentAt: d.sentAt!.toISOString(),
      canCreatePdf: !!(d.pdfStorageKey || d.bodyHtml),
      attachments: d.attachments,
    }));
  }

  async recapPdf(nominationId: string, source: string, messageId: string, userId: string) {
    const record = (await this.records(nominationId)).find(
      (d) => d.source === source && d.id === messageId,
    );
    if (!record) throw new NotFoundException('Sent ETA/NOR record not found on this nomination');
    const filename = `${record.type}-${record.sentAt!.toISOString().slice(0, 10)}-${record.id.slice(-8)}.pdf`;
    let buffer: Buffer;
    if (record.pdfStorageKey)
      buffer = (await this.attachments.storedPdf(record.pdfStorageKey, filename)).content;
    else {
      if (!record.bodyHtml)
        throw new BadRequestException('This historical record has no saved PDF or message body');
      const metadata = [
        `Subject: ${record.subject}`,
        `Sent: ${record.sentAt!.toISOString()}`,
        `To: ${record.toAddresses.join(', ')}`,
        `CC: ${record.ccAddresses.join(', ')}`,
      ].join('\n');
      // Render the archived body, never a new compose template or today's data.
      // Network and scripts are disabled for stored HTML.
      buffer = await this.pdf.renderHtml(
        `<html><head><meta charset="utf-8"></head><body><pre style="white-space:pre-wrap">${escape(metadata)}</pre><hr>${record.bodyHtml}</body></html>`,
        true,
      );
    }
    return this.attachments.upload({ filename, mimeType: 'application/pdf', buffer }, userId);
  }
}
