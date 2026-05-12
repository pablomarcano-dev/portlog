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
import { CharterersService } from './charterers.service.js';
import { CreateChartererDto, UpdateChartererDto } from './dto/charterer.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ChartererListQuerySchema } from '@portlog/schemas';
import type { ChartererListQuery } from '@portlog/schemas';

@Controller('master-data/charterers')
@Roles('OPS', 'ADM')
export class CharterersController {
  constructor(private readonly charterersService: CharterersService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ChartererListQuerySchema)) query: ChartererListQuery) {
    return this.charterersService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.charterersService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.charterersService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateChartererDto) {
    return this.charterersService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateChartererDto) {
    return this.charterersService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.charterersService.remove(id);
  }
}
