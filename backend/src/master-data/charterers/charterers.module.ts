import { Module } from '@nestjs/common';
import { CharterersController } from './charterers.controller.js';
import { CharterersService } from './charterers.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [CharterersController],
  providers: [CharterersService],
  exports: [CharterersService],
})
export class CharterersModule {}
