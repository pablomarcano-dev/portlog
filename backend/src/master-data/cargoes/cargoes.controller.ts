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
import { CargoesService } from './cargoes.service.js';
import { CreateCargoDto, UpdateCargoDto } from './dto/cargo.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CargoListQuerySchema } from '@portlog/schemas';
import type { CargoListQuery } from '@portlog/schemas';

@Controller('master-data/cargoes')
@Roles('OPS', 'ADM')
export class CargoesController {
  constructor(private readonly cargoesService: CargoesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(CargoListQuerySchema)) query: CargoListQuery) {
    return this.cargoesService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.cargoesService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.cargoesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCargoDto) {
    return this.cargoesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCargoDto) {
    return this.cargoesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.cargoesService.remove(id);
  }
}
