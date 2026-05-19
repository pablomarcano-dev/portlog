import { Module } from '@nestjs/common';
import { NominationsController } from './nominations.controller.js';
import { NominationsService } from './nominations.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [NominationsController],
  providers: [NominationsService],
  exports: [NominationsService],
})
export class NominationsModule {}
