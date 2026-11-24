import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { sofSubjectActivityInputSchema, type SofSubjectActivityInput } from '@portlog/schemas';
import { SofSubjectActivitiesService } from './sof-subject-activities.service.js';

@Controller()
@Roles('OPS', 'ADM')
export class SofSubjectActivitiesController {
  constructor(private readonly service: SofSubjectActivitiesService) {}

  @Get('nominations/:id/sof-subject-activities')
  options(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.options(id);
  }

  @Get('admin/sof-subject-activities')
  @Roles('ADM')
  list() {
    return this.service.list(true);
  }

  @Post('admin/sof-subject-activities')
  @Roles('ADM')
  create(
    @Body(new ZodValidationPipe(sofSubjectActivityInputSchema)) input: SofSubjectActivityInput,
  ) {
    return this.service.save(input);
  }

  @Patch('admin/sof-subject-activities/:id')
  @Roles('ADM')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(sofSubjectActivityInputSchema)) input: SofSubjectActivityInput,
  ) {
    return this.service.save(input, id);
  }
}
