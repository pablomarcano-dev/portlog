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
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { NominationsService } from './nominations.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  NominationCreateSchema,
  NominationUpdateSchema,
  NominationStatusTransitionSchema,
  NominationListQuerySchema,
  etaRecordSaveSchema,
  SofTimesheetInputSchema,
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationListQuery,
  type EtaRecordSaveInput,
  type SofTimesheetInput,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';
import {
  CreateNominationClientDto,
  UpdateNominationClientDto,
} from './dto/nomination-client.dto.js';

@Controller('nominations')
@Roles('OPS', 'ADM')
export class NominationsController {
  constructor(private readonly svc: NominationsService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(NominationCreateSchema)) body: NominationCreateInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.create(body, req.user.sub);
  }

  @Get()
  list(@Query(new ZodValidationPipe(NominationListQuerySchema)) query: NominationListQuery) {
    return this.svc.list(query);
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NominationUpdateSchema)) body: NominationUpdateInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.update(id, body, req.user.sub);
  }

  @Post(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(NominationStatusTransitionSchema)) body: NominationStatusTransition,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.transition(id, body, req.user.sub);
  }

  @Delete(':id')
  delete() {
    return this.svc.delete();
  }

  // ---------------------------------------------------------------------------
  // NominationClient sub-resource
  // ---------------------------------------------------------------------------

  @Get(':id/messages')
  getMessages(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getNominationMessages(id);
  }

  @Get(':id/compose/:actionType')
  getComposeData(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionType') actionType: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.getComposeData(id, actionType, req.user.email);
  }

  @Patch(':id/parcels')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateParcels(@Param('id', ParseUUIDPipe) id: string, @Body() body: { parcels: unknown[] }) {
    return this.svc.updateParcels(id, body.parcels);
  }

  @Post(':id/send-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  sendEmail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: {
      subDocType: string;
      toAddresses: string[];
      ccAddresses: string[];
      bccAddresses: string[];
      subject: string;
      bodyHtml: string;
    },
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.sendEmail(id, body, req.user.sub);
  }

  @Get(':id/eta')
  getEtaRecord(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getEtaRecord(id);
  }

  @Put(':id/eta')
  saveEtaRecord(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(etaRecordSaveSchema)) body: EtaRecordSaveInput,
  ) {
    return this.svc.saveEtaRecord(id, body);
  }

  @Get(':id/clients')
  listClients(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.listClients(id);
  }

  @Post(':id/clients')
  addClient(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateNominationClientDto) {
    return this.svc.addClient(id, dto);
  }

  @Patch(':id/clients/:clientId')
  updateClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
    @Body() dto: UpdateNominationClientDto,
  ) {
    return this.svc.updateClient(id, clientId, dto);
  }

  @Delete(':id/clients/:clientId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeClient(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('clientId', ParseUUIDPipe) clientId: string,
  ) {
    return this.svc.removeClient(id, clientId);
  }

  // ---------------------------------------------------------------------------
  // SOF Timesheet sub-resource
  // ---------------------------------------------------------------------------

  @Get(':id/sof')
  getSof(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getSofTimesheet(id);
  }

  @Put(':id/sof')
  saveSof(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SofTimesheetInputSchema)) body: SofTimesheetInput,
  ) {
    return this.svc.saveSofTimesheet(id, body);
  }
}
