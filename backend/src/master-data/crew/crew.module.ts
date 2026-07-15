import { Module } from '@nestjs/common';
import { CrewController } from './crew.controller.js';
import { CrewService } from './crew.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CrewController],
  providers: [CrewService],
  exports: [CrewService],
})
export class CrewModule {}
