import { Module } from '@nestjs/common';
import { AisController } from './ais.controller.js';
import { AisService } from './ais.service.js';
import { VesselFinderClient } from './vesselfinder.client.js';

@Module({
  controllers: [AisController],
  providers: [AisService, VesselFinderClient],
  exports: [AisService],
})
export class AisModule {}
