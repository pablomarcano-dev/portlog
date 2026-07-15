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
import { CrewService } from './crew.service.js';
import { CreateCrewDto, UpdateCrewDto } from './dto/crew.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CrewListQuerySchema } from '@portlog/schemas';
import type { CrewListQuery } from '@portlog/schemas';

/**
 * GET/POST/PATCH: OPS and ADM
 * DELETE: ADM only (Golden Rule 5 — destructive ops are admin-only)
 *
 * JwtAuthGuard and RolesGuard are registered globally in AppModule — no
 * @UseGuards() needed here.
 */
@Controller('master-data/crew')
@Roles('OPS', 'ADM')
export class CrewController {
  constructor(private readonly crewService: CrewService) {}

  @Get()
  list(@Query(new ZodValidationPipe(CrewListQuerySchema)) query: CrewListQuery) {
    return this.crewService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.crewService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.crewService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateCrewDto) {
    return this.crewService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCrewDto) {
    return this.crewService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.crewService.remove(id);
  }
}
