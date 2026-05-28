import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import Bottleneck from 'bottleneck';
import { DatalasticService } from '../datalastic/datalastic.service.js';
import { mapDatalasticToAisVessel, type VesselProData } from './ais.mapper.js';
import type { AisVessel } from '@portlog/schemas';

/**
 * AisService — orchestrates LRU caching, Bottleneck rate-limiting, and
 * the Datalastic vessel_pro endpoint to fulfil IMO → AisVessel lookups.
 *
 * Cache:  LRU, keyed by IMO, TTL 5 min (configurable via AIS_CACHE_TTL_MS),
 *         max 200 entries.
 * Rate:   Bottleneck token-bucket at 8 req/sec (configurable via AIS_RATE_LIMIT_RPS).
 * Logs:   { event: 'ais.lookup', imo, cacheHit, durationMs } — Golden Rule 8.
 */
@Injectable()
export class AisService {
  private readonly logger = new Logger(AisService.name);
  private readonly cache: LRUCache<string, AisVessel>;
  private readonly limiter: Bottleneck;

  constructor(
    private readonly datalastic: DatalasticService,
    private readonly config: ConfigService,
  ) {
    const ttlMs = this.config.get<number>('AIS_CACHE_TTL_MS') ?? 5 * 60 * 1_000;
    const rps = this.config.get<number>('AIS_RATE_LIMIT_RPS') ?? 8;

    this.cache = new LRUCache<string, AisVessel>({
      max: 200,
      ttl: Number(ttlMs),
    });

    this.limiter = new Bottleneck({
      reservoir: rps,
      reservoirRefreshAmount: rps,
      reservoirRefreshInterval: 1_000,
      maxConcurrent: rps,
      minTime: Math.floor(1_000 / rps),
    });
  }

  async lookup(imo: string): Promise<AisVessel> {
    const start = Date.now();

    const cached = this.cache.get(imo);
    if (cached !== undefined) {
      this.logger.log({ event: 'ais.lookup', imo, cacheHit: true, durationMs: Date.now() - start });
      return cached;
    }

    const raw = await this.limiter.schedule(() => this.datalastic.proxy('vessel_pro', { imo }));

    // Datalastic vessel_pro wraps the vessel object under a `data` key
    const vesselData = (raw as { data: VesselProData }).data;
    const vessel = mapDatalasticToAisVessel(vesselData);

    this.cache.set(imo, vessel);

    this.logger.log({ event: 'ais.lookup', imo, cacheHit: false, durationMs: Date.now() - start });
    return vessel;
  }
}
