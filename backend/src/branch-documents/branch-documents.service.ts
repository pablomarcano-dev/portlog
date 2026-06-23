import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PdfService } from '../pdf/pdf.service.js';
import { StorageService } from '../storage/storage.service.js';
import {
  type CreateBranchDocumentInstanceInput,
  type UpdateBranchDocumentInstanceInput,
  type BranchDocumentTemplate,
  type BranchDocumentInstance,
} from '@portlog/schemas';

@Injectable()
export class BranchDocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdf: PdfService,
    private readonly storage: StorageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Templates
  // ---------------------------------------------------------------------------

  async listTemplates(branchId: string): Promise<BranchDocumentTemplate[]> {
    const templates = await this.prisma.branchDocumentTemplate.findMany({
      where: { branchId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return templates.map((t) => this.toTemplateDto(t));
  }

  // ---------------------------------------------------------------------------
  // Instances
  // ---------------------------------------------------------------------------

  async create(
    nominationId: string,
    dto: CreateBranchDocumentInstanceInput,
    userId: string,
  ): Promise<BranchDocumentInstance> {
    await this.assertNominationExists(nominationId);
    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: dto.templateId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!template) throw new NotFoundException(`Template ${dto.templateId} not found`);

    const instance = await this.prisma.branchDocumentInstance.create({
      data: {
        nominationId,
        templateId: dto.templateId,
        title: dto.title ?? null,
        data: (dto.data ?? {}) as Prisma.InputJsonValue,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    return this.toInstanceDto(instance);
  }

  async list(nominationId: string): Promise<BranchDocumentInstance[]> {
    await this.assertNominationExists(nominationId);
    const instances = await this.prisma.branchDocumentInstance.findMany({
      where: { nominationId },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return instances.map((i) => this.toInstanceDto(i));
  }

  async findOne(nominationId: string, instanceId: string): Promise<BranchDocumentInstance> {
    const instance = await this.prisma.branchDocumentInstance.findFirst({
      where: { id: instanceId, nominationId },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!instance) throw new NotFoundException(`BranchDocumentInstance ${instanceId} not found`);
    return this.toInstanceDto(instance);
  }

  async update(
    nominationId: string,
    instanceId: string,
    dto: UpdateBranchDocumentInstanceInput,
  ): Promise<BranchDocumentInstance> {
    const instance = await this.getOrThrow(nominationId, instanceId);
    if (instance.status === 'FINALIZED') {
      throw new ForbiddenException('Finalized documents cannot be edited');
    }
    const updated = await this.prisma.branchDocumentInstance.update({
      where: { id: instanceId },
      data: {
        title: dto.title !== undefined ? dto.title : instance.title,
        data: dto.data as Prisma.InputJsonValue,
      },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    return this.toInstanceDto(updated);
  }

  async finalize(nominationId: string, instanceId: string): Promise<BranchDocumentInstance> {
    const instance = await this.getOrThrow(nominationId, instanceId);
    if (instance.status === 'FINALIZED') throw new ConflictException('Already finalized');
    const updated = await this.prisma.branchDocumentInstance.update({
      where: { id: instanceId },
      data: { status: 'FINALIZED' },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    return this.toInstanceDto(updated);
  }

  async generatePdf(
    nominationId: string,
    instanceId: string,
  ): Promise<{ minioKey: string; downloadUrl: string }> {
    const instance = await this.getOrThrow(nominationId, instanceId);

    const nomination = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      include: {
        shipParticular: { include: { flag: true } },
        opPort: true,
        lastPort: true,
        nextPort: true,
        branch: true,
      },
    });
    if (!nomination) throw new NotFoundException('Nomination not found');

    const context = this.buildPdfContext(nomination, instance.data as Record<string, unknown>);
    const templateBuffer = await this.storage.getFileBuffer(instance.template.hbsTemplate);
    const templateSource = templateBuffer.toString('utf-8');
    const buffer = await this.pdf.renderFromString(templateSource, context);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newKey = `sgc-documents/${nominationId}/branch-docs/${instance.template.code.toLowerCase()}-${timestamp}.pdf`;

    if (instance.minioKey) {
      try {
        await this.storage.deleteFile(instance.minioKey);
      } catch {
        /* ignore stale key */
      }
    }

    await this.storage.uploadFile(newKey, buffer, 'application/pdf');
    await this.prisma.branchDocumentInstance.update({
      where: { id: instanceId },
      data: { minioKey: newKey, pdfGeneratedAt: new Date() },
    });

    const downloadUrl = await this.storage.getPresignedUrl(newKey, 3600);
    return { minioKey: newKey, downloadUrl };
  }

  async getPdfUrl(
    nominationId: string,
    instanceId: string,
  ): Promise<{ url: string; expiresAt: string }> {
    const instance = await this.getOrThrow(nominationId, instanceId);
    if (!instance.minioKey) throw new BadRequestException('No PDF generated yet');
    const url = await this.storage.getPresignedUrl(instance.minioKey, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
    return { url, expiresAt };
  }

  async delete(nominationId: string, instanceId: string): Promise<void> {
    const instance = await this.getOrThrow(nominationId, instanceId);
    if (instance.status !== 'DRAFT') {
      throw new ConflictException('Only DRAFT documents can be deleted');
    }
    if (instance.minioKey) {
      try {
        await this.storage.deleteFile(instance.minioKey);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.branchDocumentInstance.delete({ where: { id: instanceId } });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildPdfContext(
    nomination: {
      correlative: number;
      master?: string | null;
      voyageNumber?: string | null;
      etaDate?: Date | null;
      shipParticular?: {
        name: string;
        imoNumber?: string | null;
        grt?: unknown;
        nrt?: unknown;
        loa?: unknown;
        flag?: { name: string };
      } | null;
      opPort?: { name: string } | null;
      lastPort?: { name: string } | null;
      nextPort?: { name: string } | null;
      branch?: {
        name: string;
        contactName?: string | null;
        contactTitle?: string | null;
        address?: string | null;
        phone?: string | null;
      } | null;
    },
    docData: Record<string, unknown>,
  ) {
    return {
      nomination: {
        correlative: nomination.correlative?.toString() ?? '',
        vesselName: nomination.shipParticular?.name ?? null,
        imo: nomination.shipParticular?.imoNumber ?? null,
        flag: nomination.shipParticular?.flag?.name ?? null,
        grt: nomination.shipParticular?.grt?.toString() ?? null,
        nrt: nomination.shipParticular?.nrt?.toString() ?? null,
        loa: nomination.shipParticular?.loa?.toString() ?? null,
        master: nomination.master ?? null,
        voyageNumber: nomination.voyageNumber ?? null,
        opPortName: (nomination.opPort as { name?: string } | null)?.name ?? null,
        lastPortName: (nomination.lastPort as { name?: string } | null)?.name ?? null,
        nextPortName: (nomination.nextPort as { name?: string } | null)?.name ?? null,
        etaDate: nomination.etaDate?.toLocaleDateString('es-VE') ?? null,
      },
      branch: {
        name: nomination.branch?.name ?? null,
        contactName: nomination.branch?.contactName ?? null,
        contactTitle: nomination.branch?.contactTitle ?? null,
        address: nomination.branch?.address ?? null,
        phone: nomination.branch?.phone ?? null,
      },
      doc: docData,
      generatedAt: new Date().toLocaleString('es-VE'),
    };
  }

  private async getOrThrow(nominationId: string, instanceId: string) {
    const instance = await this.prisma.branchDocumentInstance.findFirst({
      where: { id: instanceId, nominationId },
      include: {
        createdBy: { select: { id: true, email: true } },
        template: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      },
    });
    if (!instance) throw new NotFoundException(`BranchDocumentInstance ${instanceId} not found`);
    return instance;
  }

  private async assertNominationExists(nominationId: string): Promise<void> {
    const n = await this.prisma.nomination.findUnique({
      where: { id: nominationId },
      select: { id: true },
    });
    if (!n) throw new NotFoundException(`Nomination ${nominationId} not found`);
  }

  private toTemplateDto(t: {
    id: string;
    branchId: string;
    name: string;
    code: string;
    description: string | null;
    hbsTemplate: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    fields: Array<{
      id: string;
      templateId: string;
      key: string;
      label: string;
      type: string;
      required: boolean;
      sourceField: string | null;
      placeholder: string | null;
      options: string[];
      sortOrder: number;
    }>;
  }): BranchDocumentTemplate {
    return {
      id: t.id,
      branchId: t.branchId,
      name: t.name,
      code: t.code,
      description: t.description,
      hbsTemplate: t.hbsTemplate,
      fields: t.fields.map((f) => ({
        id: f.id,
        templateId: f.templateId,
        key: f.key,
        label: f.label,
        type: f.type as BranchDocumentTemplate['fields'][0]['type'],
        required: f.required,
        sourceField: f.sourceField,
        placeholder: f.placeholder,
        options: f.options,
        sortOrder: f.sortOrder,
      })),
      sortOrder: t.sortOrder,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toInstanceDto(i: {
    id: string;
    nominationId: string;
    templateId: string;
    data: unknown;
    status: string;
    title: string | null;
    minioKey: string | null;
    pdfGeneratedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    createdBy: { id: string; email: string };
    template: {
      id: string;
      name: string;
      code: string;
      hbsTemplate: string;
      fields: Array<{
        id: string;
        templateId: string;
        key: string;
        label: string;
        type: string;
        required: boolean;
        sourceField: string | null;
        placeholder: string | null;
        options: string[];
        sortOrder: number;
      }>;
    };
  }): BranchDocumentInstance {
    return {
      id: i.id,
      nominationId: i.nominationId,
      templateId: i.templateId,
      data: i.data as Record<string, unknown>,
      status: i.status as BranchDocumentInstance['status'],
      title: i.title,
      minioKey: i.minioKey,
      pdfGeneratedAt: i.pdfGeneratedAt?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      createdBy: i.createdBy,
      template: {
        id: i.template.id,
        name: i.template.name,
        code: i.template.code,
        fields: i.template.fields.map((f) => ({
          id: f.id,
          templateId: f.templateId,
          key: f.key,
          label: f.label,
          type: f.type as BranchDocumentInstance['template']['fields'][0]['type'],
          required: f.required,
          sourceField: f.sourceField,
          placeholder: f.placeholder,
          options: f.options,
          sortOrder: f.sortOrder,
        })),
      },
    };
  }
}
