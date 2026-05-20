import { Module } from '@nestjs/common';
import { DatalasticController } from './datalastic.controller.js';
import { DatalasticService } from './datalastic.service.js';

@Module({
  controllers: [DatalasticController],
  providers: [DatalasticService],
  exports: [DatalasticService],
})
export class DatalasticModule {}
