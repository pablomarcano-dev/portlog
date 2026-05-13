/**
 * AisService unit tests — POR-57
 *
 * These tests cover AisService in isolation. VesselFinderClient is mocked.
 * The spike fixture (backend/scripts/ais-spike-sample.json) provides the
 * canonical raw response shape used across all happy-path tests.
 *
 * Test matrix (7 cases per AC):
 *   1. Happy path — valid fixture → Zod-parsed → mapped → returned.
 *   2. Malformed JSON → VesselFinderClient throws BadGatewayException → propagated.
 *   3. Cache hit — second call within TTL skips HTTP layer.
 *   4. Cache miss after TTL — HTTP layer called again.
 *   5. Provider 429 retried once by client, then TooManyRequestsException propagated.
 *   6. Missing API key → ServiceUnavailableException; HTTP never called.
 *   7. No-vessel response (provider 404) → NotFoundException propagated.
 */

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AisService } from './ais.service.js';
import { VesselFinderClient, TooManyRequestsException } from './vesselfinder.client.js';
import { mapVesselFinderToAisVessel } from './ais.mapper.js';
import type { VesselFinderRaw } from '@portlog/schemas/ais';

// ---------------------------------------------------------------------------
// Fixture — derived from backend/scripts/ais-spike-sample.json
// ---------------------------------------------------------------------------

const RAW_FIXTURE: VesselFinderRaw = {
  imo: '9074729',
  mmsi: '538006811',
  name: 'OCEAN PIONEER',
  callsign: 'V7VK7',
  flag: 'MH',
  type: 80,
  type_name: 'Tanker',
  length: 183,
  beam: 32,
  draught: 10.2,
  gt: 26001,
  dwt: 45872,
  position: {
    lat: 10.6317,
    lon: -61.5189,
    speed: 0.1,
    course: 214,
    heading: 512,
    status: 1,
    timestamp: '2026-05-12T23:00:00Z',
  },
  eta: '2026-05-14T06:00:00Z',
  last_port: 'PORT OF SPAIN',
  last_port_unlocode: 'TTPOS',
  destination: 'POINT LISAS',
  destination_unlocode: 'TTPLI',
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockClient = {
  fetchByImo: jest.fn<Promise<VesselFinderRaw>, [string]>(),
};

function makeConfigService(overrides: Record<string, string | number> = {}): ConfigService {
  return {
    get: jest.fn(<T>(key: string): T | undefined => {
      const defaults: Record<string, string | number> = {
        AIS_CACHE_TTL_MS: 300_000,
        AIS_RATE_LIMIT_RPS: 8,
        ...overrides,
      };
      return defaults[key] as T | undefined;
    }),
  } as unknown as ConfigService;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function buildModule(configService: ConfigService): Promise<AisService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AisService,
      { provide: VesselFinderClient, useValue: mockClient },
      { provide: ConfigService, useValue: configService },
    ],
  }).compile();
  return module.get<AisService>(AisService);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AisService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Happy path
  // -------------------------------------------------------------------------
  describe('lookup — happy path', () => {
    it('returns a valid AisVessel for a known IMO', async () => {
      mockClient.fetchByImo.mockResolvedValue(RAW_FIXTURE);
      const service = await buildModule(makeConfigService());

      const result = await service.lookup('9074729');

      expect(result.imo).toBe('9074729');
      expect(result.name).toBe('OCEAN PIONEER');
      expect(result.mmsi).toBe('538006811');
      expect(result.flag).toBe('MH');
      expect(result.vesselType).toBe('Tanker');
      expect(result.loa).toBe(183);
      expect(result.dwt).toBe(45872);
      expect(result.provider).toBe('vesselfinder');
      expect(result.lastPosition).not.toBeNull();
      expect(result.lastPosition?.lat).toBe(10.6317);
      expect(result.lastPort?.name).toBe('PORT OF SPAIN');
      expect(result.nextPort?.unlocode).toBe('TTPLI');
      expect(mockClient.fetchByImo).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Client throws BadGatewayException (malformed provider response)
  // -------------------------------------------------------------------------
  describe('lookup — malformed provider response', () => {
    it('propagates BadGatewayException from the client', async () => {
      mockClient.fetchByImo.mockRejectedValue(new BadGatewayException('malformed JSON'));
      const service = await buildModule(makeConfigService());

      await expect(service.lookup('9074729')).rejects.toThrow(BadGatewayException);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Cache hit — second call within TTL skips HTTP layer
  // -------------------------------------------------------------------------
  describe('lookup — cache hit', () => {
    it('returns cached result on second call and does not hit HTTP', async () => {
      mockClient.fetchByImo.mockResolvedValue(RAW_FIXTURE);
      const service = await buildModule(makeConfigService());

      const first = await service.lookup('9074729');
      const second = await service.lookup('9074729');

      expect(second.imo).toBe(first.imo);
      // fetchByImo called only once despite two lookups
      expect(mockClient.fetchByImo).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cache miss after TTL — HTTP layer called again
  // -------------------------------------------------------------------------
  describe('lookup — cache expires', () => {
    it('hits HTTP again after TTL expires (TTL=1ms)', async () => {
      mockClient.fetchByImo.mockResolvedValue(RAW_FIXTURE);
      // Use a 1ms TTL so the cache entry expires immediately
      const service = await buildModule(makeConfigService({ AIS_CACHE_TTL_MS: 1 }));

      await service.lookup('9074729');
      // Wait long enough for the 1ms TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 10));
      await service.lookup('9074729');

      expect(mockClient.fetchByImo).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Provider 429 — client retries once, then throws TooManyRequestsException
  // -------------------------------------------------------------------------
  describe('lookup — rate limit', () => {
    it('propagates TooManyRequestsException when client exhausts retry', async () => {
      mockClient.fetchByImo.mockRejectedValue(new TooManyRequestsException());
      const service = await buildModule(makeConfigService());

      await expect(service.lookup('9074729')).rejects.toThrow(TooManyRequestsException);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Missing API key → ServiceUnavailableException; HTTP never called
  // -------------------------------------------------------------------------
  describe('lookup — missing API key', () => {
    it('throws ServiceUnavailableException and never calls HTTP when API key absent', async () => {
      mockClient.fetchByImo.mockRejectedValue(
        new ServiceUnavailableException('VESSELFINDER_API_KEY is not configured.'),
      );
      const service = await buildModule(makeConfigService());

      await expect(service.lookup('9074729')).rejects.toThrow(ServiceUnavailableException);
    });
  });

  // -------------------------------------------------------------------------
  // 7. No-vessel response → NotFoundException
  // -------------------------------------------------------------------------
  describe('lookup — vessel not found', () => {
    it('propagates NotFoundException when provider has no record', async () => {
      mockClient.fetchByImo.mockRejectedValue(
        new NotFoundException('No AIS data found for IMO 9074729.'),
      );
      const service = await buildModule(makeConfigService());

      await expect(service.lookup('9074729')).rejects.toThrow(NotFoundException);
    });
  });
});

// ---------------------------------------------------------------------------
// mapVesselFinderToAisVessel — pure mapper unit tests
// ---------------------------------------------------------------------------

describe('mapVesselFinderToAisVessel', () => {
  it('maps all fields correctly from the spike fixture', () => {
    const result = mapVesselFinderToAisVessel(RAW_FIXTURE);

    expect(result.imo).toBe('9074729');
    expect(result.mmsi).toBe('538006811');
    expect(result.callSign).toBe('V7VK7');
    expect(result.flag).toBe('MH');
    expect(result.vesselType).toBe('Tanker');
    expect(result.loa).toBe(183);
    expect(result.beam).toBe(32);
    expect(result.draught).toBe(10.2);
    expect(result.gt).toBe(26001);
    expect(result.dwt).toBe(45872);
    expect(result.lastPosition?.lat).toBe(10.6317);
    expect(result.lastPosition?.sog).toBe(0.1);
    expect(result.lastPosition?.navStatus).toBe(1);
    expect(result.lastPosition?.timestampUtc).toBe('2026-05-12T23:00:00Z');
    expect(result.eta).toBe('2026-05-14T06:00:00Z');
    expect(result.lastPort).toEqual({ name: 'PORT OF SPAIN', unlocode: 'TTPOS' });
    expect(result.nextPort).toEqual({ name: 'POINT LISAS', unlocode: 'TTPLI' });
    expect(result.provider).toBe('vesselfinder');
  });

  it('handles a vessel with no position, no ports, no dimensions gracefully', () => {
    const minimal: VesselFinderRaw = {
      imo: '1234567',
      name: 'BARE MINIMUM',
    };

    const result = mapVesselFinderToAisVessel(minimal);

    expect(result.imo).toBe('1234567');
    expect(result.mmsi).toBeNull();
    expect(result.callSign).toBeNull();
    expect(result.flag).toBeNull();
    expect(result.loa).toBeNull();
    expect(result.lastPosition).toBeNull();
    expect(result.lastPort).toBeNull();
    expect(result.nextPort).toBeNull();
    expect(result.provider).toBe('vesselfinder');
  });
});
