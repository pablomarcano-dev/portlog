import { Module } from '@nestjs/common';
import { CargoesController } from './cargoes.controller.js';
import { CargoesService } from './cargoes.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CargoesController],
  providers: [CargoesService],
  exports: [CargoesService],
})
export class CargoesModule {}
