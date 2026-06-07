import {
  Injectable,
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { EmailService } from '../email/email.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { StorageService } from '../storage/storage.service.js';
import type { SendSubDocumentInput, SubDocExtraData } from '@portlog/schemas';
import type { PedrSubDocumentType } from '@portlog/schemas';

// Full nomination include needed to build PDF template data
const NOMINATION_INCLUDE = {
  shipParticular: { select: { id: true, name: true, imoNumber: true } },
  opPort: { select: { id: true, name: true, abbreviation: true } },
  pier: { select: { id: true, name: true } },
  lastPort: { select: { id: true, name: true } },
  nextPort: { select: { id: true, name: true } },
  nominationClients: { orderBy: { sortOrder: 'asc' as const } },
} as const;

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly pdfService: PdfService,
    private readonly storageService: StorageService,
  ) {}

  async sendSubDocument(pedrId: string, dto: SendSubDocumentInput, userId: string) {
    const { subDocType, toAddresses, ccAddresses, subject, bodyHtml, extraData } = dto;

    // 1. Fetch PEDR + nomination data
    const pedr = await this.prisma.pedr.findUnique({
      where: { id: pedrId },
      select: {
        id: true,
        currentStage: true,
        nomination: {
          select: {
            id: true,
            correlative: true,
            voyageNumber: true,
            etaDate: true,
            parcels: true,
            ...NOMINATION_INCLUDE,
          },
        },
      },
    });

    if (!pedr) {
      throw new NotFoundException(`PEDR ${pedrId} not found.`);
    }

    const { nomination } = pedr;

    // 2. Build template data based on sub-document type
    const baseData: Record<string, unknown> = {
      vesselName: nomination.shipParticular?.name ?? '',
      imoNumber: nomination.shipParticular?.imoNumber ?? '',
      portName: nomination.opPort?.name ?? '',
      portAbbrev: nomination.opPort?.abbreviation ?? '',
      eta: nomination.etaDate ? nomination.etaDate.toISOString() : '',
      correlative: nomination.correlative,
      voyageNumber: nomination.voyageNumber,
      charterer: '',
      chartererName: '',
      owner: '',
      operator: '',
      agentName: '',
      sentAt: new Date().toISOString(),
    };

    // 2b. For SOF: fetch events ordered by occurredAt asc (server-side; no extraData needed)
    // 2c. For CARGO_UPDATE: compute update number from prior dispatches
    let cargoUpdateNumber = 1;
    if (subDocType === 'CARGO_UPDATE') {
      const count = await this.prisma.emailDispatch.count({
        where: { pedrId, subDocType: 'CARGO_UPDATE' },
      });
      cargoUpdateNumber = count + 1;
    }

    let sofEvents: Array<{
      kind: string;
      occurredAt: Date;
      note: string | null;
      recordedBy: { email: string };
    }> = [];
    if (subDocType === 'SOF') {
      sofEvents = await this.prisma.pedrEvent.findMany({
        where: { pedrId },
        orderBy: { occurredAt: 'asc' },
        select: {
          kind: true,
          occurredAt: true,
          note: true,
          recordedBy: { select: { email: true } },
        },
      });
    }

    const templateData = this.buildTemplateData(
      subDocType as PedrSubDocumentType,
      baseData,
      nomination,
      extraData,
      sofEvents,
      cargoUpdateNumber,
    );

    // 3. Generate PDF
    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await this.pdfService.renderSubDocument(
        subDocType as PedrSubDocumentType,
        templateData,
      );
    } catch (err) {
      this.logger.error({
        event: 'dispatch.pdf.error',
        pedrId,
        subDocType,
        err,
      });
      throw new InternalServerErrorException('PDF generation failed');
    }

    // 4. Upload PDF to MinIO
    const filename = `${subDocType.toLowerCase()}-${Date.now()}.pdf`;
    const storageKey = `dispatches/${pedrId}/${filename}`;
    let pdfStorageKey: string | null = null;

    try {
      await this.storageService.uploadFile(storageKey, pdfBuffer, 'application/pdf');
      pdfStorageKey = storageKey;
    } catch (err) {
      this.logger.warn({
        event: 'dispatch.storage.warn',
        pedrId,
        subDocType,
        err,
        message: 'MinIO unavailable — proceeding without storage',
      });
      // Non-fatal: email will still be sent, storage key will be null
    }

    // 5. Create EmailDispatch record (PENDING — sentAt is null until send succeeds)
    const dispatch = await this.prisma.emailDispatch.create({
      data: {
        pedrId,
        subDocType,
        toAddresses,
        ccAddresses: ccAddresses ?? [],
        subject,
        bodyHtml: bodyHtml ?? null,
        pdfStorageKey,
        sentById: userId,
      },
    });

    // 6. Send email
    const emailBody = bodyHtml ?? this.defaultBody(subDocType as PedrSubDocumentType, baseData);

    try {
      await this.emailService.send({
        to: toAddresses,
        cc: ccAddresses,
        subject,
        html: emailBody,
        attachments: [
          {
            filename,
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ],
      });

      // 7. Mark sentAt
      const updated = await this.prisma.emailDispatch.update({
        where: { id: dispatch.id },
        data: { sentAt: new Date() },
      });

      this.logger.log({
        event: 'dispatch.sent',
        dispatchId: dispatch.id,
        pedrId,
        subDocType,
        userId,
      });

      return updated;
    } catch (err) {
      // Record the error but don't delete the dispatch record
      await this.prisma.emailDispatch.update({
        where: { id: dispatch.id },
        data: { error: err instanceof Error ? err.message : String(err) },
      });

      this.logger.error({
        event: 'dispatch.send.error',
        dispatchId: dispatch.id,
        pedrId,
        subDocType,
        err,
      });

      throw new InternalServerErrorException('Email send failed — dispatch recorded with error');
    }
  }

  async getDispatches(pedrId: string) {
    const pedr = await this.prisma.pedr.findUnique({
      where: { id: pedrId },
      select: { id: true },
    });

    if (!pedr) {
      throw new NotFoundException(`PEDR ${pedrId} not found.`);
    }

    const items = await this.prisma.emailDispatch.findMany({
      where: { pedrId },
      orderBy: { createdAt: 'desc' },
    });

    return { items };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildTemplateData(
    type: PedrSubDocumentType,
    base: Record<string, unknown>,
    nomination: {
      pier?: { name: string } | null | undefined;
      lastPort?: { name: string } | null | undefined;
      nextPort?: { name: string } | null | undefined;
      parcels?: unknown;
    },
    extraData?: SubDocExtraData,
    sofEvents: Array<{
      kind: string;
      occurredAt: Date;
      note: string | null;
      recordedBy: { email: string };
    }> = [],
    cargoUpdateNumber = 1,
  ): Record<string, unknown> {
    switch (type) {
      case 'ACKNOWLEDGEMENT':
        return {
          ...base,
          // acknowledgement.hbs uses chartererName, agentName, cargoName
          cargoName: this.extractCargoName(nomination.parcels),
          remarks: null,
        };

      case 'PREARRIVAL':
        return {
          ...base,
          berthPort: nomination.pier?.name ?? '',
          lastPort: nomination.lastPort?.name ?? '',
          nextPort: nomination.nextPort?.name ?? '',
          // prearrival.hbs uses cargoName, agentName
          cargoName: this.extractCargoName(nomination.parcels),
          flagName: '',
          etb: '',
          quantity: '',
          requirements: null,
        };

      case 'ETA_ETB':
        return {
          ...base,
          // base already contains eta from nomination.etaDate
          etb: extraData?.etb ?? '',
          berthNumber: extraData?.berthNumber ?? '',
          etcDate: extraData?.etcDate ?? '',
          remarks: null,
        };

      case 'NOR':
        return {
          ...base,
          berthPort: nomination.pier?.name ?? '',
          cargoName: this.extractCargoName(nomination.parcels),
          norTenderedAt: extraData?.norTenderedAt ?? '',
          norAcceptedAt: extraData?.norAcceptedAt ?? '',
          layTimeCommences: extraData?.layTimeCommences ?? '',
        };

      case 'SOF':
        return {
          ...base,
          cargoName: this.extractCargoName(nomination.parcels),
          berth: nomination.pier?.name ?? '',
          blQuantity: '',
          outturnQuantity: '',
          generatedAt: new Date().toISOString(),
          signedOffAt: null,
          events: sofEvents.map((e) => ({
            kind: e.kind,
            occurredAt: e.occurredAt.toISOString(),
            note: e.note ?? '',
            recordedBy: e.recordedBy.email,
          })),
        };

      case 'CARGO_UPDATE':
        return {
          ...base,
          cargoName: this.extractCargoName(nomination.parcels),
          blQuantity: extraData?.blQuantity ?? '',
          blDate: extraData?.blDate ?? '',
          vesselFigure: extraData?.vesselFigure ?? '',
          shoreFigure: extraData?.shoreFigure ?? '',
          remarks: extraData?.remarks ?? null,
          updateNumber: cargoUpdateNumber,
          generatedAt: new Date().toISOString(),
        };

      default:
        return base;
    }
  }

  private extractCargoName(parcels: unknown): string {
    if (!Array.isArray(parcels)) return '';
    const first = parcels[0];
    if (first && typeof first === 'object' && 'product' in first) {
      return String((first as Record<string, unknown>)['product'] ?? '');
    }
    return '';
  }

  private defaultBody(type: PedrSubDocumentType, data: Record<string, unknown>): string {
    const vessel = String(data['vesselName'] ?? '');
    const port = String(data['portName'] ?? '');
    switch (type) {
      case 'ACKNOWLEDGEMENT':
        return `<p>Please find attached the Acknowledgement of Nomination for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      case 'PREARRIVAL':
        return `<p>Please find attached the Pre-Arrival Notification for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      case 'ETA_ETB':
        return `<p>Please find attached the ETA/ETB Notice for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      case 'NOR':
        return `<p>Please find attached the Notice of Readiness for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      case 'SOF':
        return `<p>Please find attached the Statement of Facts for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      case 'CARGO_UPDATE':
        return `<p>Please find attached the Cargo Update for vessel <strong>${vessel}</strong> at port <strong>${port}</strong>.</p>`;
      default:
        return `<p>Please find the attached document for vessel <strong>${vessel}</strong>.</p>`;
    }
  }
}
