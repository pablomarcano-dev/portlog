import { Module } from '@nestjs/common';
import { AisController } from './ais.controller.js';
import { AisService } from './ais.service.js';
import { DatalasticModule } from '../datalastic/datalastic.module.js';

@Module({
  imports: [DatalasticModule],
  controllers: [AisController],
  providers: [AisService],
  exports: [AisService],
})
export class AisModule {}
