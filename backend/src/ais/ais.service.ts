import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';
import Bottleneck from 'bottleneck';
import { VesselFinderClient } from './vesselfinder.client.js';
import { mapVesselFinderToAisVessel } from './ais.mapper.js';
import type { AisVessel } from '@portlog/schemas';

/**
 * AisService — orchestrates LRU caching, Bottleneck rate-limiting, and
 * the VesselFinder HTTP client to fulfil IMO → AisVessel lookups.
 *
 * Cache:  LRU, keyed by IMO, TTL 5 min (configurable via AIS_CACHE_TTL_MS),
 *         max 200 entries.
 * Rate:   Bottleneck token-bucket at 8 req/sec (configurable via AIS_RATE_LIMIT_RPS).
 * Retry:  One retry on 429, handled in VesselFinderClient.
 * Logs:   { event: 'ais.lookup', imo, cacheHit, durationMs } — Golden Rule 8.
 */
@Injectable()
export class AisService {
  private readonly logger = new Logger(AisService.name);
  private readonly cache: LRUCache<string, AisVessel>;
  private readonly limiter: Bottleneck;

  constructor(
    private readonly client: VesselFinderClient,
    private readonly config: ConfigService,
  ) {
    const ttlMs = this.config.get<number>('AIS_CACHE_TTL_MS') ?? 5 * 60 * 1_000; // 5 min
    const rps = this.config.get<number>('AIS_RATE_LIMIT_RPS') ?? 8;

    this.cache = new LRUCache<string, AisVessel>({
      max: 200,
      ttl: Number(ttlMs),
    });

    this.limiter = new Bottleneck({
      reservoir: rps,
      reservoirRefreshAmount: rps,
      reservoirRefreshInterval: 1_000, // refill every second
      maxConcurrent: rps,
      minTime: Math.floor(1_000 / rps),
    });
  }

  async lookup(imo: string): Promise<AisVessel> {
    const start = Date.now();

    // Cache hit path
    const cached = this.cache.get(imo);
    if (cached !== undefined) {
      this.logger.log({ event: 'ais.lookup', imo, cacheHit: true, durationMs: Date.now() - start });
      return cached;
    }

    // Cache miss — schedule through Bottleneck, then fetch
    const raw = await this.limiter.schedule(() => this.client.fetchByImo(imo));
    const vessel = mapVesselFinderToAisVessel(raw);

    this.cache.set(imo, vessel);

    this.logger.log({ event: 'ais.lookup', imo, cacheHit: false, durationMs: Date.now() - start });
    return vessel;
  }
}
