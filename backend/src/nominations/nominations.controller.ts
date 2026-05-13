import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
  type NominationCreateInput,
  type NominationUpdateInput,
  type NominationStatusTransition,
  type NominationListQuery,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

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
}
