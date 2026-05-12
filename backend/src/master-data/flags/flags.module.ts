import { Module } from '@nestjs/common';
import { FlagsController } from './flags.controller.js';
import { FlagsService } from './flags.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [FlagsController],
  providers: [FlagsService],
  exports: [FlagsService],
})
export class FlagsModule {}
