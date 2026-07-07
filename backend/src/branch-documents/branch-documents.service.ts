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
  type CreateBranchDocumentTemplateInput,
  type UpdateBranchDocumentTemplateInput,
  type CreateBranchDocumentTemplateFieldInput,
  type UpdateBranchDocumentTemplateFieldInput,
  type ReorderTemplateFieldsInput,
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

  async generatePdf(nominationId: string, instanceId: string): Promise<{ minioKey: string }> {
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

    return { minioKey: newKey };
  }

  async downloadPdf(
    nominationId: string,
    instanceId: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const instance = await this.getOrThrow(nominationId, instanceId);
    if (!instance.minioKey) throw new BadRequestException('No PDF generated yet');
    const buffer = await this.storage.getFileBuffer(instance.minioKey);
    return { buffer, filename: `${instance.template.code}.pdf` };
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
  // Template CRUD (ADM)
  // ---------------------------------------------------------------------------

  private async assertTemplateOwnership(
    branchId: string,
    templateId: string,
  ): Promise<{ id: string; branchId: string; code: string; branch: { code: string } }> {
    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, branchId: true, code: true, branch: { select: { code: true } } },
    });
    if (!template) throw new NotFoundException(`Template ${templateId} not found`);
    if (template.branchId !== branchId)
      throw new NotFoundException(`Template ${templateId} not found`);
    return template;
  }

  async createTemplate(
    branchId: string,
    dto: CreateBranchDocumentTemplateInput,
  ): Promise<BranchDocumentTemplate> {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });
    if (!branch) throw new NotFoundException(`Branch ${branchId} not found`);

    try {
      const template = await this.prisma.branchDocumentTemplate.create({
        data: {
          branchId,
          name: dto.name,
          code: dto.code,
          description: dto.description ?? null,
          sortOrder: dto.sortOrder ?? 0,
          hbsTemplate: '',
        },
        include: { fields: { orderBy: { sortOrder: 'asc' } } },
      });
      return this.toTemplateDto(template);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(
          `Template with code '${dto.code}' already exists for this branch`,
        );
      }
      throw e;
    }
  }

  async updateTemplate(
    branchId: string,
    templateId: string,
    dto: UpdateBranchDocumentTemplateInput,
  ): Promise<BranchDocumentTemplate> {
    await this.assertTemplateOwnership(branchId, templateId);
    const template = await this.prisma.branchDocumentTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description ?? null }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toTemplateDto(template);
  }

  async deleteTemplate(branchId: string, templateId: string): Promise<void> {
    await this.assertTemplateOwnership(branchId, templateId);
    const instanceCount = await this.prisma.branchDocumentInstance.count({
      where: { templateId },
    });
    if (instanceCount > 0) {
      throw new ConflictException(
        `Template has ${instanceCount} existing document(s) and cannot be deleted`,
      );
    }
    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: templateId },
      select: { hbsTemplate: true },
    });
    if (template?.hbsTemplate) {
      try {
        await this.storage.deleteFile(template.hbsTemplate);
      } catch {
        /* ignore missing file */
      }
    }
    await this.prisma.branchDocumentTemplate.delete({ where: { id: templateId } });
  }

  async uploadHbs(
    branchId: string,
    templateId: string,
    content: string,
  ): Promise<BranchDocumentTemplate> {
    const tpl = await this.assertTemplateOwnership(branchId, templateId);
    const minioKey = `branch-templates/${tpl.branch.code.toLowerCase()}/${tpl.code.toLowerCase().replace(/_/g, '-')}.hbs`;
    await this.storage.uploadFile(minioKey, Buffer.from(content, 'utf-8'), 'text/plain');
    const updated = await this.prisma.branchDocumentTemplate.update({
      where: { id: templateId },
      data: { hbsTemplate: minioKey },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toTemplateDto(updated);
  }

  // ---------------------------------------------------------------------------
  // Field CRUD (ADM)
  // ---------------------------------------------------------------------------

  async createField(
    branchId: string,
    templateId: string,
    dto: CreateBranchDocumentTemplateFieldInput,
  ): Promise<BranchDocumentTemplate> {
    await this.assertTemplateOwnership(branchId, templateId);
    try {
      await this.prisma.branchDocumentTemplateField.create({
        data: {
          templateId,
          key: dto.key,
          label: dto.label,
          type: dto.type,
          required: dto.required ?? false,
          sourceField: dto.sourceField ?? null,
          placeholder: dto.placeholder ?? null,
          options: dto.options ?? [],
          sortOrder: dto.sortOrder ?? 0,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException(`Field with key '${dto.key}' already exists in this template`);
      }
      throw e;
    }
    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: templateId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toTemplateDto(template!);
  }

  async updateField(
    branchId: string,
    templateId: string,
    fieldId: string,
    dto: UpdateBranchDocumentTemplateFieldInput,
  ): Promise<BranchDocumentTemplate> {
    await this.assertTemplateOwnership(branchId, templateId);
    const field = await this.prisma.branchDocumentTemplateField.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.templateId !== templateId)
      throw new NotFoundException(`Field ${fieldId} not found`);

    await this.prisma.branchDocumentTemplateField.update({
      where: { id: fieldId },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.required !== undefined && { required: dto.required }),
        ...(dto.sourceField !== undefined && { sourceField: dto.sourceField ?? null }),
        ...(dto.placeholder !== undefined && { placeholder: dto.placeholder ?? null }),
        ...(dto.options !== undefined && { options: dto.options }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: templateId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toTemplateDto(template!);
  }

  async deleteField(branchId: string, templateId: string, fieldId: string): Promise<void> {
    await this.assertTemplateOwnership(branchId, templateId);
    const field = await this.prisma.branchDocumentTemplateField.findUnique({
      where: { id: fieldId },
    });
    if (!field || field.templateId !== templateId)
      throw new NotFoundException(`Field ${fieldId} not found`);
    await this.prisma.branchDocumentTemplateField.delete({ where: { id: fieldId } });
  }

  async reorderFields(
    branchId: string,
    templateId: string,
    items: ReorderTemplateFieldsInput,
  ): Promise<BranchDocumentTemplate> {
    await this.assertTemplateOwnership(branchId, templateId);
    await this.prisma.$transaction(
      items.map((item) =>
        this.prisma.branchDocumentTemplateField.update({
          where: { id: item.id },
          data: { sortOrder: item.sortOrder },
        }),
      ),
    );
    const template = await this.prisma.branchDocumentTemplate.findUnique({
      where: { id: templateId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.toTemplateDto(template!);
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
      dispatchTypes: ['EXPORTACIÓN', 'TRÁNSITO', 'CABOTAJE', 'TRANSBORDO', 'TURISMO', 'LASTRE'].map(
        (label) => ({ label, selected: label === (docData['dispatch_type'] ?? '') }),
      ),
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
