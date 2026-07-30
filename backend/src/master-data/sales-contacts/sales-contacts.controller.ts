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
import { SalesContactsService } from './sales-contacts.service.js';
import { CreateSalesContactDto, UpdateSalesContactDto } from './dto/sales-contact.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { SalesContactListQuerySchema } from '@portlog/schemas';
import type { SalesContactListQuery } from '@portlog/schemas';

/**
 * GET/POST/PATCH: OPS and ADM
 * DELETE: ADM only (Golden Rule 5 — destructive ops are admin-only)
 *
 * JwtAuthGuard and RolesGuard are registered globally in AppModule — no
 * @UseGuards() needed here.
 */
@Controller('master-data/sales-contacts')
@Roles('OPS', 'ADM')
export class SalesContactsController {
  constructor(private readonly salesContactsService: SalesContactsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(SalesContactListQuerySchema)) query: SalesContactListQuery) {
    return this.salesContactsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.salesContactsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.salesContactsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateSalesContactDto) {
    return this.salesContactsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSalesContactDto) {
    return this.salesContactsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.salesContactsService.remove(id);
  }
}
