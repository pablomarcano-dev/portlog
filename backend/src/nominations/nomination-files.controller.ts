import { Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { Roles } from '../auth/roles.decorator.js';
import type { RequestUser } from '../auth/jwt.strategy.js';
import { NominationFilesService } from './nomination-files.service.js';

@Controller()
@Roles('OPS', 'ADM')
export class NominationFilesController {
  constructor(private readonly files: NominationFilesService) {}

  @Get('master-data/ports/:portId/prearrival-documents')
  terminal(@Param('portId') portId: string) {
    return this.files.terminalFiles(portId);
  }

  @Post('master-data/ports/:portId/prearrival-documents/:attachmentId')
  file(
    @Param('portId') portId: string,
    @Param('attachmentId') id: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.files.fileAtTerminal(portId, id, req.user.sub);
  }

  @Delete('master-data/ports/:portId/prearrival-documents/:attachmentId')
  retire(@Param('portId') portId: string, @Param('attachmentId') id: string) {
    return this.files.retireTerminalFile(portId, id);
  }

  @Get('nominations/:id/prearrival-documents')
  prearrival(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.prearrivalFiles(id);
  }

  @Get('nominations/:id/recap-documents')
  recap(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.recapFiles(id);
  }

  @Post('nominations/:id/recap-documents/:source/:messageId/pdf')
  pdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('source') source: string,
    @Param('messageId') messageId: string,
    @Req() req: { user: RequestUser },
  ) {
    return this.files.recapPdf(id, source, messageId, req.user.sub);
  }
}
