import { Module } from '@nestjs/common';
import { PortsController } from './ports.controller.js';
import { PortsService } from './ports.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PortsController],
  providers: [PortsService],
  exports: [PortsService],
})
export class PortsModule {}
