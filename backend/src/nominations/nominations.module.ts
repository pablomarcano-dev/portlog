import { Module } from '@nestjs/common';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { EmailModule } from '../email/email.module.js';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [NominationsController],
  providers: [NominationsService],
  exports: [NominationsService],
})
export class NominationsModule {}
