import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { PedrService } from './pedr.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  createPedrSchema,
  updatePedrRequirementsSchema,
  pedrStageTransitionSchema,
  pedrListQuerySchema,
  type CreatePedrInput,
  type UpdatePedrRequirementsInput,
  type PedrStageTransition,
  type PedrListQuery,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

@Controller('pedr')
@Roles('OPS', 'ADM')
export class PedrController {
  constructor(private readonly svc: PedrService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(createPedrSchema)) body: CreatePedrInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.create(body, req.user.sub);
  }

  @Get()
  list(@Query(new ZodValidationPipe(pedrListQuerySchema)) query: PedrListQuery) {
    return this.svc.list(query);
  }

  @Get('by-nomination/:nominationId')
  byNomination(@Param('nominationId', ParseUUIDPipe) nominationId: string) {
    return this.svc.getByNominationId(nominationId);
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getById(id);
  }

  @Patch(':id/requirements')
  @Roles('ADM')
  updateRequirements(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updatePedrRequirementsSchema)) body: UpdatePedrRequirementsInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.updateRequirements(id, body, req.user.sub);
  }

  @Post(':id/transition')
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(pedrStageTransitionSchema)) body: PedrStageTransition,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.transition(id, body, req.user.sub);
  }

  @Get(':id/history')
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getHistory(id);
  }
}
