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
import { SHDocumentsService } from './sh-documents.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  CreateSHDocumentSchema,
  UpdateSHDocumentSchema,
  SendShDocumentSchema,
  type CreateSHDocumentInput,
  type UpdateSHDocumentInput,
  type SendShDocumentInput,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

@Controller('nominations/:nominationId/sh-documents')
@Roles('OPS', 'ADM')
export class SHDocumentsController {
  constructor(private readonly service: SHDocumentsService) {}

  @Post()
  create(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Body(new ZodValidationPipe(CreateSHDocumentSchema)) dto: CreateSHDocumentInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.create(nominationId, dto, req.user.sub);
  }

  @Get()
  list(@Param('nominationId', ParseUUIDPipe) nominationId: string) {
    return this.service.list(nominationId);
  }

  @Get(':shId')
  findOne(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.service.findOne(nominationId, shId);
  }

  @Put(':shId')
  update(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
    @Body(new ZodValidationPipe(UpdateSHDocumentSchema)) dto: UpdateSHDocumentInput,
  ) {
    return this.service.update(nominationId, shId, dto);
  }

  @Post(':shId/send')
  send(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
    @Body(new ZodValidationPipe(SendShDocumentSchema)) dto: SendShDocumentInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.send(nominationId, shId, dto, req.user.sub);
  }

  @Post(':shId/finalize')
  finalize(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.service.finalize(nominationId, shId);
  }

  @Post(':shId/generate')
  generatePdf(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.service.generatePdf(nominationId, shId);
  }

  @Get(':shId/pdf-url')
  getPdfUrl(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    return this.service.getPdfUrl(nominationId, shId);
  }

  @Delete(':shId')
  @HttpCode(204)
  @Roles('ADM')
  async delete(
    @Param('nominationId', ParseUUIDPipe) nominationId: string,
    @Param('shId', ParseUUIDPipe) shId: string,
  ) {
    await this.service.delete(nominationId, shId);
  }
}
