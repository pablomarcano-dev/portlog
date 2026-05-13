import { Module } from '@nestjs/common';
import { ShipParticularsController } from './ship-particulars.controller.js';
import { ShipParticularsService } from './ship-particulars.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ShipParticularsController],
  providers: [ShipParticularsService],
  exports: [ShipParticularsService],
})
export class ShipParticularsModule {}
