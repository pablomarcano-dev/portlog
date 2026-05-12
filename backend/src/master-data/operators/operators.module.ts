import { Module } from '@nestjs/common';
import { OperatorsController } from './operators.controller.js';
import { OperatorsService } from './operators.service.js';
import { PrismaModule } from '../../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [OperatorsController],
  providers: [OperatorsService],
  exports: [OperatorsService],
})
export class OperatorsModule {}
