import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  ServiceRequestCreateSchema,
  ServiceRequestListQuerySchema,
  ServiceRequestSendSchema,
  ServiceRequestTransitionSchema,
  ServiceRequestUpdateSchema,
  attachmentIdsSchema,
  type ServiceRequestCreate,
  type ServiceRequestListQuery,
  type ServiceRequestSend,
  type ServiceRequestTransition,
  type ServiceRequestUpdate,
} from '@portlog/schemas';
import { ServiceRequestsService } from './service-requests.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { RequestUser } from '../auth/jwt.strategy.js';

const AddDocumentsSchema = z.object({
  attachmentIds: attachmentIdsSchema.unwrap().min(1, 'At least one attachment is required'),
});
type AddDocumentsInput = z.infer<typeof AddDocumentsSchema>;

/**
 * Service Requests are horizontal — they hang off a vessel, not a nomination —
 * so the route is top-level rather than nested under /nominations/:id.
 *
 * Visible to OPS and ADM alike, matching the Sales flow this replaces.
 */
@Controller('service-requests')
@Roles('OPS', 'ADM')
export class ServiceRequestsController {
  constructor(private readonly service: ServiceRequestsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ServiceRequestListQuerySchema)) query: ServiceRequestListQuery,
  ) {
    return this.service.list(query);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(ServiceRequestCreateSchema)) dto: ServiceRequestCreate,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.create(dto, req.user.sub);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ServiceRequestUpdateSchema)) dto: ServiceRequestUpdate,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  /** Mark COMPLETED or CANCELLED. */
  @Post(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ServiceRequestTransitionSchema)) dto: ServiceRequestTransition,
  ) {
    return this.service.transition(id, dto);
  }

  // ---------------------------------------------------------------------------
  // Authorisation documents — files are uploaded via POST /api/attachments
  // first, then filed against the request here.
  // ---------------------------------------------------------------------------

  @Post(':id/documents')
  addDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AddDocumentsSchema)) dto: AddDocumentsInput,
  ) {
    return this.service.addDocuments(id, dto.attachmentIds);
  }

  @Delete(':id/documents/:attachmentId')
  removeDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    return this.service.removeDocument(id, attachmentId);
  }

  // ---------------------------------------------------------------------------
  // Purchase order
  // ---------------------------------------------------------------------------

  /** Render (or re-render) the order without sending — the Review step preview. */
  @Post(':id/generate')
  generate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.generateOrderPdf(id);
  }

  @Get(':id/order.pdf')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const file = await this.service.downloadOrderPdf(id);
    await reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="${file.filename}"`)
      .send(file.buffer);
  }

  /** Generate the purchase order and email it to the provider. */
  @Post(':id/send')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ServiceRequestSendSchema)) dto: ServiceRequestSend,
    @Req() req: { user: RequestUser },
  ) {
    return this.service.sendOrder(id, dto, req.user.sub);
  }

  @Get(':id/dispatches')
  dispatches(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listDispatches(id);
  }
}
