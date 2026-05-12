import { Module } from '@nestjs/common';
import { ActivitiesController } from './activities.controller.js';
import { ActivitiesService } from './activities.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
  exports: [ActivitiesService],
})
export class ActivitiesModule {}
