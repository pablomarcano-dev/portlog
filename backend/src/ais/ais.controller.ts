import { Controller, Get, Param } from '@nestjs/common';
import { AisService } from './ais.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { z } from 'zod';

const ImoParamSchema = z.string().regex(/^\d{7}$/, 'IMO must be exactly 7 digits');

/**
 * AisController — exposes:
 *   GET /api/ais/vessels/:imo
 *
 * Guards: JwtAuthGuard (global) + RolesGuard (global) with @Roles('OPS', 'ADM').
 * IMO param is validated with a Zod pipe (7 digits, rejects immediately with 400).
 *
 * Response codes:
 *   200 — AisVessel JSON
 *   400 — IMO format invalid
 *   401 — no / bad JWT
 *   403 — insufficient role
 *   404 — provider has no record for this IMO
 *   429 — provider rate-limit exhausted after one retry
 *   502 — provider 5xx or malformed response
 *   503 — VESSELFINDER_API_KEY not set
 */
@Controller('ais')
@Roles('OPS', 'ADM')
export class AisController {
  constructor(private readonly aisService: AisService) {}

  @Get('vessels/:imo')
  getVessel(@Param('imo', new ZodValidationPipe(ImoParamSchema)) imo: string) {
    return this.aisService.lookup(imo);
  }
}
