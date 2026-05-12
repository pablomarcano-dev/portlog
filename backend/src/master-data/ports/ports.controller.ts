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
import { PortsService } from './ports.service.js';
import { CreatePortDto, UpdatePortDto } from './dto/port.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { PortListQuerySchema } from '@portlog/schemas';
import type { PortListQuery } from '@portlog/schemas';

@Controller('master-data/ports')
@Roles('OPS', 'ADM')
export class PortsController {
  constructor(private readonly portsService: PortsService) {}

  @Get('tree')
  getTree() {
    return this.portsService.getTree();
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.portsService.search(q ?? '');
  }

  @Get()
  list(@Query(new ZodValidationPipe(PortListQuerySchema)) query: PortListQuery) {
    return this.portsService.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.portsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreatePortDto) {
    return this.portsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePortDto) {
    return this.portsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.portsService.remove(id);
  }
}
