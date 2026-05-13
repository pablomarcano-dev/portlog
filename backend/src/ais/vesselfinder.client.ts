import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VesselFinderRawResponseSchema } from '@portlog/schemas/ais';
import type { VesselFinderRaw } from '@portlog/schemas/ais';

/**
 * TooManyRequestsException — HTTP 429 exception for when the VesselFinder
 * rate limit is exhausted after one Retry-After-aware retry.
 * NestJS does not ship a built-in 429 exception class.
 */
export class TooManyRequestsException extends HttpException {
  constructor() {
    super('AIS provider rate limit reached. Please retry shortly.', HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * VesselFinderClient — thin HTTP wrapper around the VesselFinder REST API.
 *
 * Responsibilities:
 *   - Resolves base URL and API key from ConfigService.
 *   - Sets the X-API-Key header (never logs the key — Golden Rule 8).
 *   - Handles 404 → NotFoundException, 5xx → BadGatewayException.
 *   - On 429: reads Retry-After (capped at 5 s), waits, retries once.
 *     If still 429 after retry, propagates TooManyRequestsException.
 *   - Validates raw response with VesselFinderRawResponseSchema (Golden Rule 10).
 *
 * The service layer owns caching and Bottleneck scheduling.
 */
@Injectable()
export class VesselFinderClient {
  private readonly logger = new Logger(VesselFinderClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;

  private static readonly MAX_RETRY_AFTER_MS = 5_000;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('VESSELFINDER_BASE_URL') ?? 'https://api.vf-api.com/v2';
    this.apiKey = this.config.get<string>('VESSELFINDER_API_KEY');
  }

  /**
   * Fetch vessel details by 7-digit IMO number.
   * Throws ServiceUnavailableException if the API key is not configured.
   */
  async fetchByImo(imo: string): Promise<VesselFinderRaw> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'AIS service is not available: VESSELFINDER_API_KEY is not configured.',
      );
    }

    return this.doFetch(imo, false);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async doFetch(imo: string, isRetry: boolean): Promise<VesselFinderRaw> {
    const url = `${this.baseUrl}/vessels?imo=${encodeURIComponent(imo)}`;

    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          // Golden Rule 8: API key is in the header, NOT logged anywhere.
          'X-API-Key': this.apiKey!,
          Accept: 'application/json',
        },
      });
    } catch {
      this.logger.error({ event: 'ais.fetch.network_error', imo, isRetry });
      throw new BadGatewayException('AIS provider is unreachable.');
    }

    if (res.ok) {
      return this.parseResponse(imo, res);
    }

    if (res.status === 404) {
      throw new NotFoundException(`No AIS data found for IMO ${imo}.`);
    }

    if (res.status === 429) {
      if (isRetry) {
        // Already retried once — propagate.
        this.logger.warn({ event: 'ais.fetch.rate_limit_exceeded', imo });
        throw new TooManyRequestsException();
      }
      const delayMs = this.parseRetryAfter(res);
      this.logger.warn({ event: 'ais.fetch.rate_limit', imo, delayMs });
      await sleep(delayMs);
      return this.doFetch(imo, true);
    }

    // 5xx or unexpected status
    this.logger.error({ event: 'ais.fetch.provider_error', imo, status: res.status, isRetry });
    throw new BadGatewayException(`AIS provider returned ${res.status}.`);
  }

  private async parseResponse(imo: string, res: Response): Promise<VesselFinderRaw> {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      this.logger.error({ event: 'ais.fetch.json_parse_error', imo });
      throw new BadGatewayException('AIS provider returned malformed JSON.');
    }

    // Unwrap `data` wrapper if present (as in the spike fixture shape).
    const payload = isWrapped(body) ? body.data : body;

    const parsed = VesselFinderRawResponseSchema.safeParse(payload);
    if (!parsed.success) {
      this.logger.error({
        event: 'ais.fetch.schema_validation_failed',
        imo,
        errors: parsed.error.flatten(),
      });
      throw new BadGatewayException('AIS provider returned an unexpected response shape.');
    }

    return parsed.data;
  }

  private parseRetryAfter(res: Response): number {
    const header = res.headers.get('Retry-After');
    if (!header) return VesselFinderClient.MAX_RETRY_AFTER_MS;
    const seconds = Number(header);
    if (!Number.isFinite(seconds) || seconds <= 0) return VesselFinderClient.MAX_RETRY_AFTER_MS;
    return Math.min(seconds * 1_000, VesselFinderClient.MAX_RETRY_AFTER_MS);
  }
}

// ---------------------------------------------------------------------------
// Module-local helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWrapped(body: unknown): body is { data: unknown } {
  return typeof body === 'object' && body !== null && 'data' in body;
}
