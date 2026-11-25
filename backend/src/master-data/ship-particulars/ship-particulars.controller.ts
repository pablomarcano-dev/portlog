import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ShipParticularsService } from './ship-particulars.service.js';
import { CreateShipParticularDto, UpdateShipParticularDto } from './dto/ship-particular.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ShipParticularListQuerySchema } from '@portlog/schemas';
import type { RequestUser } from '../../auth/jwt.strategy.js';
import type { ShipParticularListQuery } from '@portlog/schemas';

@Controller('master-data/ship-particulars')
@Roles('OPS', 'ADM')
export class ShipParticularsController {
  constructor(private readonly shipParticularsService: ShipParticularsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ShipParticularListQuerySchema)) query: ShipParticularListQuery,
    @Req() req: { user: RequestUser },
  ) {
    return this.shipParticularsService.list(
      query,
      req.user.role === 'OPS' ? (req.user.branchId ?? '__unassigned__') : undefined,
    );
  }

  @Get('search')
  search(@Query('q') q: string, @Req() req: { user: RequestUser }) {
    return this.shipParticularsService.search(
      q ?? '',
      req.user.role === 'OPS' ? (req.user.branchId ?? '__unassigned__') : undefined,
    );
  }

  @Get('by-imo/:imo')
  findByImo(@Param('imo') imo: string, @Req() req: { user: RequestUser }) {
    return this.shipParticularsService.findByImo(
      imo,
      req.user.role === 'OPS' ? (req.user.branchId ?? '__unassigned__') : undefined,
    );
  }

  @Get(':id')
  getById(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    return this.shipParticularsService.getById(
      id,
      req.user.role === 'OPS' ? (req.user.branchId ?? '__unassigned__') : undefined,
    );
  }

  @Post()
  @Roles('ADM', 'FLT')
  create(@Body() dto: CreateShipParticularDto) {
    return this.shipParticularsService.create(dto);
  }

  @Patch(':id')
  @Roles('ADM', 'FLT')
  update(@Param('id') id: string, @Body() dto: UpdateShipParticularDto) {
    return this.shipParticularsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM', 'FLT')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.shipParticularsService.remove(id);
  }
}
