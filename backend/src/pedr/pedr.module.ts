import { Module } from '@nestjs/common';
import { PedrController } from './pedr.controller.js';
import { PedrService } from './pedr.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PedrController],
  providers: [PedrService],
  exports: [PedrService],
})
export class PedrModule {}
