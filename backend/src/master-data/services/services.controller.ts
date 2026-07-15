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
import { ServicesService } from './services.service.js';
import { CreateServiceDto, UpdateServiceDto } from './dto/service.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ServiceListQuerySchema } from '@portlog/schemas';
import type { ServiceListQuery } from '@portlog/schemas';

/**
 * GET/POST/PATCH: OPS and ADM
 * DELETE: ADM only (Golden Rule 5 — destructive ops are admin-only)
 * JwtAuthGuard and RolesGuard are registered globally in AppModule — no @UseGuards() needed.
 */
@Controller('master-data/services')
@Roles('OPS', 'ADM')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ServiceListQuerySchema)) query: ServiceListQuery) {
    return this.servicesService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.servicesService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.servicesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateServiceDto) {
    return this.servicesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.servicesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.servicesService.remove(id);
  }
}
