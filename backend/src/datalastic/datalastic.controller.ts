import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { DatalasticService } from './datalastic.service.js';
import { Roles } from '../auth/roles.decorator.js';

const ALLOWED_ENDPOINTS = new Set([
  'port_find',
  'port',
  'vessel_inradius',
  'vessel',
  'vessel_pro',
  'vessel_info',
  'vessel_history',
  'ownership',
  'inspections',
  'dry_dock_dates',
  'engine',
]);

/**
 * DatalasticController — proxies GET /datalastic/:endpoint to Datalastic API.
 *
 * Guards: JwtAuthGuard (global) + RolesGuard (global) with @Roles('OPS', 'ADM').
 * All query params are forwarded as-is to the service (minus the api-key,
 * which is injected server-side from env).
 */
@Controller('datalastic')
@Roles('OPS', 'ADM')
export class DatalasticController {
  constructor(private readonly datalasticService: DatalasticService) {}

  @Get(':endpoint')
  proxy(
    @Param('endpoint') endpoint: string,
    @Query() query: Record<string, string>,
  ): Promise<object> {
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      throw new NotFoundException(`Unknown Datalastic endpoint: ${endpoint}`);
    }
    return this.datalasticService.proxy(
      endpoint as Parameters<DatalasticService['proxy']>[0],
      query,
    );
  }
}
