import { Module } from '@nestjs/common';
import { PortsController } from './ports.controller.js';
import { PortsService } from './ports.service.js';
import { PiersController } from './piers.controller.js';
import { PiersService } from './piers.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PortsController, PiersController],
  providers: [PortsService, PiersService],
  exports: [PortsService],
})
export class PortsModule {}
