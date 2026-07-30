import { Module } from '@nestjs/common';
import { SalesContactsController } from './sales-contacts.controller.js';
import { SalesContactsService } from './sales-contacts.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [SalesContactsController],
  providers: [SalesContactsService],
  exports: [SalesContactsService],
})
export class SalesContactsModule {}
