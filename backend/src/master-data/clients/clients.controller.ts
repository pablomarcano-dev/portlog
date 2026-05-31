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
import { ClientsService } from './clients.service.js';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ClientListQuerySchema } from '@portlog/schemas';
import type { ClientListQuery } from '@portlog/schemas';

@Controller('master-data/clients')
@Roles('OPS', 'ADM')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ClientListQuerySchema)) query: ClientListQuery) {
    return this.clientsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.clientsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.clientsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
