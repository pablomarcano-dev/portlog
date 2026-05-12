import { Module } from '@nestjs/common';
import { ShippersController } from './shippers.controller.js';
import { ShippersService } from './shippers.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ShippersController],
  providers: [ShippersService],
  exports: [ShippersService],
})
export class ShippersModule {}
