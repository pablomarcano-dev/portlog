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
} from '@nestjs/common';
import { ShipParticularsService } from './ship-particulars.service.js';
import { CreateShipParticularDto, UpdateShipParticularDto } from './dto/ship-particular.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ShipParticularListQuerySchema } from '@portlog/schemas';
import type { ShipParticularListQuery } from '@portlog/schemas';

@Controller('master-data/ship-particulars')
@Roles('OPS', 'ADM')
export class ShipParticularsController {
  constructor(private readonly shipParticularsService: ShipParticularsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ShipParticularListQuerySchema)) query: ShipParticularListQuery,
  ) {
    return this.shipParticularsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.shipParticularsService.search(q ?? '');
  }

  @Get('by-imo/:imo')
  findByImo(@Param('imo') imo: string) {
    return this.shipParticularsService.findByImo(imo);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.shipParticularsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateShipParticularDto) {
    return this.shipParticularsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShipParticularDto) {
    return this.shipParticularsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.shipParticularsService.remove(id);
  }
}
