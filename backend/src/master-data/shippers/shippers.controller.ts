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
import { ShippersService } from './shippers.service.js';
import { CreateShipperDto, UpdateShipperDto } from './dto/shipper.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ShipperListQuerySchema } from '@portlog/schemas';
import type { ShipperListQuery } from '@portlog/schemas';

@Controller('master-data/shippers')
@Roles('OPS', 'ADM')
export class ShippersController {
  constructor(private readonly shippersService: ShippersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ShipperListQuerySchema)) query: ShipperListQuery) {
    return this.shippersService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.shippersService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.shippersService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateShipperDto) {
    return this.shippersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateShipperDto) {
    return this.shippersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.shippersService.remove(id);
  }
}
