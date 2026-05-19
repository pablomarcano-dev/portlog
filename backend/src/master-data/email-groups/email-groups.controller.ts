import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { Roles } from '../../auth/roles.decorator.js';
import { EmailGroupsService } from './email-groups.service.js';
import { CreateEmailGroupDto, UpdateEmailGroupDto } from './dto/email-group.dto.js';
import { EmailGroupListQuerySchema } from '@portlog/schemas';
import type { EmailGroupListQuery } from '@portlog/schemas';

/**
 * GET endpoints: OPS and ADM (read-only for OPS)
 * POST/PATCH/DELETE: ADM only
 *
 * JwtAuthGuard and RolesGuard are registered globally — no @UseGuards() needed.
 * Golden Rule 5: authorization enforced in the backend via @Roles().
 */
@Controller('master-data/email-groups')
@Roles('OPS', 'ADM')
export class EmailGroupsController {
  constructor(private readonly svc: EmailGroupsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(EmailGroupListQuerySchema)) query: EmailGroupListQuery) {
    return this.svc.list(query);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Post()
  @Roles('ADM')
  create(@Body() dto: CreateEmailGroupDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @Roles('ADM')
  update(@Param('id') id: string, @Body() dto: UpdateEmailGroupDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @Roles('ADM')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }
}
