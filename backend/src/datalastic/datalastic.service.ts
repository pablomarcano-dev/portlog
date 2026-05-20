import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LRUCache } from 'lru-cache';

const ALLOWED_ENDPOINTS = {
  port_find: 'https://api.datalastic.com/api/v0/port_find',
  port: 'https://api.datalastic.com/api/v0/port',
  vessel_inradius: 'https://api.datalastic.com/api/v0/vessel_inradius',
  vessel: 'https://api.datalastic.com/api/v0/vessel',
  vessel_pro: 'https://api.datalastic.com/api/v0/vessel_pro',
  vessel_info: 'https://api.datalastic.com/api/v0/vessel_info',
  vessel_history: 'https://api.datalastic.com/api/v0/vessel_history',
  ownership: 'https://api.datalastic.com/api/maritime_reports/ownership',
  inspections: 'https://api.datalastic.com/api/maritime_reports/inspections',
  dry_dock_dates: 'https://api.datalastic.com/api/maritime_reports/dry_dock_dates',
  engine: 'https://api.datalastic.com/api/maritime_reports/engine',
} as const;

type AllowedEndpoint = keyof typeof ALLOWED_ENDPOINTS;

/**
 * DatalasticService — proxies requests to the Datalastic API with LRU caching.
 *
 * Cache:  LRU, keyed by `${endpoint}:${JSON.stringify(sortedParams)}`, TTL 5 min
 *         (configurable via DATALASTIC_CACHE_TTL_MS), max 500 entries.
 * Auth:   DATALASTIC_API_KEY injected server-side — never exposed to client.
 * Logs:   { event: 'datalastic.proxy', endpoint, cacheHit, durationMs } — Golden Rule 8.
 */
@Injectable()
export class DatalasticService {
  private readonly logger = new Logger(DatalasticService.name);
  private readonly cache: LRUCache<string, object>;

  constructor(private readonly config: ConfigService) {
    const ttlMs = this.config.get<number>('DATALASTIC_CACHE_TTL_MS') ?? 5 * 60 * 1_000;

    this.cache = new LRUCache<string, object>({
      max: 500,
      ttl: Number(ttlMs),
    });
  }

  async proxy(endpoint: AllowedEndpoint, params: Record<string, string>): Promise<object> {
    if (!(endpoint in ALLOWED_ENDPOINTS)) {
      throw new NotFoundException(`Unknown Datalastic endpoint: ${endpoint}`);
    }

    const apiKey = this.config.get<string>('DATALASTIC_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('DATALASTIC_API_KEY not configured');
    }

    const start = Date.now();

    // Build cache key without the api-key (it's always the same, and we don't
    // want it stored in cache keys that could appear in logs).
    const sortedParams = Object.fromEntries(
      Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
    );
    const cacheKey = `${endpoint}:${JSON.stringify(sortedParams)}`;

    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      this.logger.log({
        event: 'datalastic.proxy',
        endpoint,
        cacheHit: true,
        durationMs: Date.now() - start,
      });
      return cached;
    }

    // Cache miss — call Datalastic
    const url = new URL(ALLOWED_ENDPOINTS[endpoint]);
    const searchParams = new URLSearchParams({ ...params, 'api-key': apiKey });
    url.search = searchParams.toString();

    const res = await fetch(url.toString());

    if (!res.ok) {
      this.logger.warn({
        event: 'datalastic.proxy',
        endpoint,
        cacheHit: false,
        durationMs: Date.now() - start,
        statusCode: res.status,
      });
      throw new BadGatewayException(`Datalastic returned ${res.status} for endpoint ${endpoint}`);
    }

    const data: object = (await res.json()) as object;
    this.cache.set(cacheKey, data);

    this.logger.log({
      event: 'datalastic.proxy',
      endpoint,
      cacheHit: false,
      durationMs: Date.now() - start,
    });

    return data;
  }
}
