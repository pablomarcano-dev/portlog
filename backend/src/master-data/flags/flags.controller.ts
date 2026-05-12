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
import { FlagsService } from './flags.service.js';
import { CreateFlagDto, UpdateFlagDto } from './dto/flag.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { FlagListQuerySchema } from '@portlog/schemas';
import type { FlagListQuery } from '@portlog/schemas';

/**
 * GET/POST/PATCH: OPS and ADM
 * DELETE: ADM only (Golden Rule 5 — destructive ops are admin-only)
 *
 * JwtAuthGuard and RolesGuard are registered globally in AppModule — no
 * @UseGuards() needed here.
 */
@Controller('master-data/flags')
@Roles('OPS', 'ADM')
export class FlagsController {
  constructor(private readonly flagsService: FlagsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(FlagListQuerySchema)) query: FlagListQuery) {
    return this.flagsService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.flagsService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.flagsService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateFlagDto) {
    return this.flagsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateFlagDto) {
    return this.flagsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.flagsService.remove(id);
  }
}
