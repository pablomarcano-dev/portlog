import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { BranchDocumentsService } from './branch-documents.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CreateBranchDocumentInstanceSchema,
  UpdateBranchDocumentInstanceSchema,
  type CreateBranchDocumentInstanceInput,
  type UpdateBranchDocumentInstanceInput,
  CreateBranchDocumentTemplateSchema,
  type CreateBranchDocumentTemplateInput,
  UpdateBranchDocumentTemplateSchema,
  type UpdateBranchDocumentTemplateInput,
  CreateBranchDocumentTemplateFieldSchema,
  type CreateBranchDocumentTemplateFieldInput,
  UpdateBranchDocumentTemplateFieldSchema,
  type UpdateBranchDocumentTemplateFieldInput,
  ReorderTemplateFieldsSchema,
  type ReorderTemplateFieldsInput,
  UploadHbsSchema,
  type UploadHbsInput,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

@Roles('OPS', 'ADM')
@Controller()
export class BranchDocumentsController {
  constructor(private readonly service: BranchDocumentsService) {}

  // ---------------------------------------------------------------------------
  // Templates (branch-scoped)
  // ---------------------------------------------------------------------------

  @Get('branches/:branchId/document-templates')
  listTemplates(@Param('branchId') branchId: string) {
    return this.service.listTemplates(branchId);
  }

  // ---------------------------------------------------------------------------
  // Instances (nomination-scoped)
  // ---------------------------------------------------------------------------

  @Post('nominations/:nominationId/branch-documents')
  create(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Body(new ZodValidationPipe(CreateBranchDocumentInstanceSchema))
    dto: CreateBranchDocumentInstanceInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.create(nominationId, dto, req.user.sub);
  }

  @Get('nominations/:nominationId/branch-documents')
  list(@Param('nominationId', ParseUUIDPipe) nominationId: string) {
    return this.service.list(nominationId);
  }

  @Get('nominations/:nominationId/branch-documents/:instanceId')
  findOne(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.service.findOne(nominationId, instanceId);
  }

  @Put('nominations/:nominationId/branch-documents/:instanceId')
  update(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body(new ZodValidationPipe(UpdateBranchDocumentInstanceSchema))
    dto: UpdateBranchDocumentInstanceInput,
  ) {
    return this.service.update(nominationId, instanceId, dto);
  }

  @Post('nominations/:nominationId/branch-documents/:instanceId/finalize')
  finalize(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.service.finalize(nominationId, instanceId);
  }

  @Post('nominations/:nominationId/branch-documents/:instanceId/generate-pdf')
  generatePdf(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.service.generatePdf(nominationId, instanceId);
  }

  @Get('nominations/:nominationId/branch-documents/:instanceId/download')
  async download(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Res() res: Response,
  ) {
    const { buffer, filename } = await this.service.downloadPdf(nominationId, instanceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @Delete('nominations/:nominationId/branch-documents/:instanceId')
  @HttpCode(204)
  async delete(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    await this.service.delete(nominationId, instanceId);
  }

  // ---------------------------------------------------------------------------
  // Template management (ADM only)
  // ---------------------------------------------------------------------------

  @Roles('ADM')
  @Post('branches/:branchId/document-templates')
  createTemplate(
    @Param('branchId') branchId: string,
    @Body(new ZodValidationPipe(CreateBranchDocumentTemplateSchema))
    dto: CreateBranchDocumentTemplateInput,
  ) {
    return this.service.createTemplate(branchId, dto);
  }

  @Roles('ADM')
  @Patch('branches/:branchId/document-templates/:templateId')
  updateTemplate(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(UpdateBranchDocumentTemplateSchema))
    dto: UpdateBranchDocumentTemplateInput,
  ) {
    return this.service.updateTemplate(branchId, templateId, dto);
  }

  @Roles('ADM')
  @Delete('branches/:branchId/document-templates/:templateId')
  @HttpCode(204)
  async deleteTemplate(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
  ) {
    await this.service.deleteTemplate(branchId, templateId);
  }

  @Roles('ADM')
  @Post('branches/:branchId/document-templates/:templateId/hbs')
  uploadHbs(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(UploadHbsSchema)) dto: UploadHbsInput,
  ) {
    return this.service.uploadHbs(branchId, templateId, dto.content);
  }

  // ---------------------------------------------------------------------------
  // Field management (ADM only)
  // ---------------------------------------------------------------------------

  @Roles('ADM')
  @Post('branches/:branchId/document-templates/:templateId/fields')
  createField(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(CreateBranchDocumentTemplateFieldSchema))
    dto: CreateBranchDocumentTemplateFieldInput,
  ) {
    return this.service.createField(branchId, templateId, dto);
  }

  @Roles('ADM')
  @Patch('branches/:branchId/document-templates/:templateId/fields/:fieldId')
  updateField(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Param('fieldId') fieldId: string,
    @Body(new ZodValidationPipe(UpdateBranchDocumentTemplateFieldSchema))
    dto: UpdateBranchDocumentTemplateFieldInput,
  ) {
    return this.service.updateField(branchId, templateId, fieldId, dto);
  }

  @Roles('ADM')
  @Delete('branches/:branchId/document-templates/:templateId/fields/:fieldId')
  @HttpCode(204)
  async deleteField(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Param('fieldId') fieldId: string,
  ) {
    await this.service.deleteField(branchId, templateId, fieldId);
  }

  @Roles('ADM')
  @Put('branches/:branchId/document-templates/:templateId/fields/reorder')
  reorderFields(
    @Param('branchId') branchId: string,
    @Param('templateId') templateId: string,
    @Body(new ZodValidationPipe(ReorderTemplateFieldsSchema))
    dto: ReorderTemplateFieldsInput,
  ) {
    return this.service.reorderFields(branchId, templateId, dto);
  }
}
