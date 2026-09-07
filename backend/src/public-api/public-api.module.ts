import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiKeyGuard } from './api-key.guard.js';
import { PublicNominationsController } from './public-nominations.controller.js';
import { PublicNominationsService } from './public-nominations.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PublicNominationsController],
  providers: [ApiKeyGuard, PublicNominationsService],
})
export class PublicApiModule {}
