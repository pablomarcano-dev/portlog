import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { DispatchService } from './dispatch.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { sendSubDocumentSchema, type SendSubDocumentInput } from '@portlog/schemas';
import type { RequestUser } from '../auth/jwt.strategy.js';

@Controller('dispatch')
@Roles('OPS', 'ADM')
export class DispatchController {
  constructor(private readonly svc: DispatchService) {}

  /**
   * POST /dispatch/pedr/:pedrId/sub-document
   * Send a sub-document email for a PEDR.
   */
  @Post('pedr/:pedrId/sub-document')
  sendSubDocument(
    @Param('pedrId', ParseUUIDPipe) pedrId: string,
    @Body(new ZodValidationPipe(sendSubDocumentSchema)) body: SendSubDocumentInput,
    @Req() req: { user: RequestUser },
  ) {
    return this.svc.sendSubDocument(pedrId, body, req.user.sub);
  }

  /**
   * GET /dispatch/pedr/:pedrId/dispatches
   * Return the dispatch log for a PEDR.
   */
  @Get('pedr/:pedrId/dispatches')
  getDispatches(@Param('pedrId', ParseUUIDPipe) pedrId: string) {
    return this.svc.getDispatches(pedrId);
  }
}
