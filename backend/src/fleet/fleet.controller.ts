import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { FleetService } from './fleet.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  addFleetVesselsSchema,
  fleetQuerySchema,
  updateFleetVesselSchema,
  type AddFleetVesselsInput,
  type FleetQuery,
  type UpdateFleetVesselInput,
} from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

@Controller('fleet')
@Roles('OPS', 'ADM')
export class FleetController {
  constructor(private readonly svc: FleetService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(fleetQuerySchema)) query: FleetQuery,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.list(req.user.sub, query.unlocode);
  }

  @Post()
  add(
    @Body(new ZodValidationPipe(addFleetVesselsSchema)) body: AddFleetVesselsInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.addMany(req.user.sub, body.unlocode, body.imos);
  }

  @Delete(':imo')
  remove(
    @Param('imo') imo: string,
    @Query(new ZodValidationPipe(fleetQuerySchema)) query: FleetQuery,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.remove(req.user.sub, query.unlocode, imo);
  }

  @Delete()
  clear(
    @Query(new ZodValidationPipe(fleetQuerySchema)) query: FleetQuery,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.clear(req.user.sub, query.unlocode);
  }

  @Patch(':imo')
  updateZarpe(
    @Param('imo') imo: string,
    @Body(new ZodValidationPipe(updateFleetVesselSchema)) body: UpdateFleetVesselInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.updateZarpe(req.user.sub, body.unlocode, imo, body.zarpeSince);
  }
}
