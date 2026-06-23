import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { BranchDocumentsService } from './branch-documents.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CreateBranchDocumentInstanceSchema,
  UpdateBranchDocumentInstanceSchema,
  type CreateBranchDocumentInstanceInput,
  type UpdateBranchDocumentInstanceInput,
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

  @Get('nominations/:nominationId/branch-documents/:instanceId/pdf-url')
  getPdfUrl(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    return this.service.getPdfUrl(nominationId, instanceId);
  }

  @Delete('nominations/:nominationId/branch-documents/:instanceId')
  @HttpCode(204)
  async delete(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
  ) {
    await this.service.delete(nominationId, instanceId);
  }
}
