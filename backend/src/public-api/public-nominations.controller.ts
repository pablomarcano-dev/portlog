import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { PublicNominationListQuerySchema, type PublicNominationListQuery } from '@portlog/schemas';
import { Public } from '../auth/public.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { PublicApiExceptionFilter } from './public-api-exception.filter.js';
import { PublicNominationsService } from './public-nominations.service.js';

@Public()
@UseGuards(ApiKeyGuard)
@UseFilters(PublicApiExceptionFilter)
@Throttle({ default: { limit: 120, ttl: 60_000 } })
@Controller('public/v1/nominations')
export class PublicNominationsController {
  constructor(private readonly nominations: PublicNominationsService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(PublicNominationListQuerySchema))
    query: PublicNominationListQuery,
  ) {
    return this.nominations.list(query);
  }

  @Get(':id')
  byId(@Param('id', ParseUUIDPipe) id: string) {
    return this.nominations.byId(id);
  }
}
