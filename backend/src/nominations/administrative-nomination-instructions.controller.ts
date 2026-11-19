import { Controller, Get, Param, ParseUUIDPipe, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Roles } from '../auth/roles.decorator.js';
import { AdministrativeNominationInstructionsService } from './administrative-nomination-instructions.service.js';

@Controller('nominations')
@Roles('OPS', 'ADM')
export class AdministrativeNominationInstructionsController {
  constructor(private readonly instructions: AdministrativeNominationInstructionsService) {}

  @Get(':id/administrative-nomination-instructions.docx')
  async download(@Param('id', ParseUUIDPipe) id: string, @Res() reply: FastifyReply) {
    const { buffer, filename } = await this.instructions.generate(id);
    await reply
      .header('Cache-Control', 'private, no-store')
      .header(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }
}
