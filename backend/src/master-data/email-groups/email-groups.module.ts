import { Module } from '@nestjs/common';
import { EmailGroupsController } from './email-groups.controller.js';
import { EmailGroupsService } from './email-groups.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [EmailGroupsController],
  providers: [EmailGroupsService],
  exports: [EmailGroupsService],
})
export class EmailGroupsModule {}
