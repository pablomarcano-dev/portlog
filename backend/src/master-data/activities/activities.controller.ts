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
import { ActivitiesService } from './activities.service.js';
import { CreateActivityDto, UpdateActivityDto } from './dto/activity.dto.js';
import { Roles } from '../../auth/roles.decorator.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { ActivityListQuerySchema } from '@portlog/schemas';
import type { ActivityListQuery } from '@portlog/schemas';

@Controller('master-data/activities')
@Roles('OPS', 'ADM')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ActivityListQuerySchema)) query: ActivityListQuery) {
    return this.activitiesService.list(query);
  }

  @Get('search')
  search(@Query('q') q: string) {
    return this.activitiesService.search(q ?? '');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.activitiesService.getById(id);
  }

  @Post()
  create(@Body() dto: CreateActivityDto) {
    return this.activitiesService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateActivityDto) {
    return this.activitiesService.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }
}
