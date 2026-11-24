import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Roles } from '../auth/roles.decorator.js';
import { AdministrativeNominationInstructionsService } from './administrative-nomination-instructions.service.js';
import { DocxPreviewService } from './docx-preview.service.js';
import { NominationsService } from './nominations.service.js';

@Controller('nominations')
@Roles('OPS', 'ADM')
export class NominationInstructionsPreviewController {
  constructor(
    private readonly nominations: NominationsService,
    private readonly administrative: AdministrativeNominationInstructionsService,
    private readonly preview: DocxPreviewService,
  ) {}

  @Get(':id/nomination-instructions.pdf')
  async operational(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    return this.respond(await this.nominations.generateNominationInstructions(id), reply);
  }

  @Get(':id/administrative-nomination-instructions.pdf')
  async administrativePreview(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    return this.respond(await this.administrative.generate(id), reply);
  }

  private async respond(file: { buffer: Buffer; filename: string }, reply: FastifyReply) {
    const pdf = await this.preview.convert(file.buffer);
    const filename = file.filename.replace(/\.docx$/i, '.pdf');
    await reply
      .header('Cache-Control', 'private, no-store')
      .header('Content-Type', 'application/pdf')
      .header('X-Content-Type-Options', 'nosniff')
      .header(
        'Content-Disposition',
        `inline; filename="nomination-instructions.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      )
      .send(pdf);
  }
}
