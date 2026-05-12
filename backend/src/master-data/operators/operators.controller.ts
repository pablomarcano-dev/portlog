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
import { OperatorsService } from './operators.service.js';
import { CreateOperatorDto, UpdateOperatorDto } from './dto/operator.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { OperatorListQuerySchema } from '@portlog/schemas';
import type { OperatorListQuery } from '@portlog/schemas';

@Controller('master-data/operators')
@Roles('OPS', 'ADM')
export class OperatorsController {
  constructor(private readonly operatorsService: OperatorsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(OperatorListQuerySchema)) query: OperatorListQuery) {
    return this.operatorsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.operatorsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.operatorsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateOperatorDto) {
    return this.operatorsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateOperatorDto) {
    return this.operatorsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.operatorsService.remove(id);
  }
}
