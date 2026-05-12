/* eslint-disable no-console */
/**
 * AIS provider spike — POR-42 / M2-S15
 *
 * Performs an IMO → vessel-details round-trip against the VesselFinder API
 * and validates the response with a placeholder Zod schema.
 *
 * This is throwaway-quality spike code. Do NOT wire into backend/src/.
 * The real AIS integration belongs in M3.
 *
 * Usage:
 *   node --loader ts-node/esm backend/scripts/ais-spike.ts 9074729
 *
 * Environment:
 *   AIS_API_KEY — VesselFinder API key (from .env.spike, never committed)
 *
 * Sample output is saved to backend/scripts/ais-spike-sample.json (secrets scrubbed).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

// Load .env.spike if present — never commit this file
// Resolve relative to repo root (cwd must be repo root when running the script)
const repoRoot = path.resolve(process.cwd());
const envSpikePath = path.resolve(repoRoot, '.env.spike');
if (fs.existsSync(envSpikePath)) {
  const lines = fs.readFileSync(envSpikePath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (key && !process.env[key]) {
      process.env[key] = val;
    }
  }
}

import { z } from 'zod';

// ---------------------------------------------------------------------------
// VesselFinder API response shape (placeholder — extend from real response)
// ---------------------------------------------------------------------------

const PositionSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  speed: z.number().optional(), // speed over ground, knots
  course: z.number().optional(), // course over ground, degrees
  heading: z.number().optional(), // true heading, degrees
  status: z.number().optional(), // AIS navigational status (0=underway, 1=anchored, etc.)
  timestamp: z.string().optional(), // ISO 8601 UTC
});

const VesselSchema = z.object({
  imo: z.string(),
  mmsi: z.string().optional(),
  name: z.string(),
  callsign: z.string().optional(),
  flag: z.string().optional(), // ISO 3166-1 alpha-2 country code
  type: z.number().optional(), // AIS vessel type code
  type_name: z.string().optional(),
  // Dimensions
  length: z.number().optional(), // LOA in metres
  beam: z.number().optional(),
  draught: z.number().optional(), // current draught reported by vessel
  // Tonnage
  gt: z.number().optional(), // gross tonnage
  dwt: z.number().optional(), // deadweight tonnage
  // Position
  position: PositionSchema.optional(),
  // Port call data
  eta: z.string().optional(), // ISO 8601 UTC
  last_port: z.string().optional(),
  last_port_unlocode: z.string().optional(),
  destination: z.string().optional(),
  destination_unlocode: z.string().optional(),
});

type Vessel = z.infer<typeof VesselSchema>;

// ---------------------------------------------------------------------------
// VesselFinder API client (spike-grade, no retries, no circuit breaker)
// ---------------------------------------------------------------------------

const VESSEL_FINDER_BASE = 'https://api.vf-api.com/v2';

async function lookupByImo(imo: string, apiKey: string): Promise<unknown> {
  const endpoint = `${VESSEL_FINDER_BASE}/vessels?imo=${encodeURIComponent(imo)}`;
  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(
      `VesselFinder API error: ${res.status} ${res.statusText} — ${await res.text()}`,
    );
  }

  return res.json() as Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Build a mock response for when no API key is configured.
// This lets the script demonstrate the Zod schema without live credentials.
// IMO 9074729 corresponds to a real vessel (used as reference example).
// ---------------------------------------------------------------------------

function buildMockResponse(imo: string): unknown {
  return {
    imo,
    mmsi: '538006811',
    name: 'OCEAN PIONEER',
    callsign: 'V7VK7',
    flag: 'MH', // Marshall Islands
    type: 80, // Tanker
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
      heading: 512, // 512 = not available per AIS spec
      status: 1, // At anchor
      timestamp: '2026-05-12T23:00:00Z',
    },
    eta: '2026-05-14T06:00:00Z',
    last_port: 'PORT OF SPAIN',
    last_port_unlocode: 'TTPOS',
    destination: 'POINT LISAS',
    destination_unlocode: 'TTPLI',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const imo = process.argv[2] ?? '9074729'; // Default: a known vessel (OCEAN PIONEER)
  const apiKey = process.env['AIS_API_KEY'];

  console.log(`\nAIS spike — IMO: ${imo}`);
  console.log('Provider: VesselFinder (https://vf-api.com)');

  let rawJson: unknown;

  if (!apiKey) {
    console.warn('\n[WARN] AIS_API_KEY not set. Using mock response to demonstrate Zod schema.');
    console.warn(
      '       Set AIS_API_KEY in .env.spike to run against the real VesselFinder API.\n',
    );
    rawJson = buildMockResponse(imo);
  } else {
    console.log('Calling VesselFinder API...\n');
    rawJson = await lookupByImo(imo, apiKey);
  }

  // Validate with Zod
  const parsed = VesselSchema.safeParse(rawJson);

  if (parsed.success) {
    const vessel: Vessel = parsed.data;
    console.log('Zod validation: PASS');
    console.log('\nParsed vessel details:');
    console.log(JSON.stringify(vessel, null, 2));
  } else {
    console.error('Zod validation: FAIL');
    console.error('Errors:', JSON.stringify(parsed.error.flatten(), null, 2));
    console.log('\nRaw response that failed validation:');
    console.log(JSON.stringify(rawJson, null, 2));
  }

  // Write sample fixture (secrets never enter the response — only data fields)
  const samplePath = path.resolve(repoRoot, 'backend/scripts/ais-spike-sample.json');
  const sampleData = {
    _note:
      'Fixture generated by ais-spike.ts. API keys and account IDs are scrubbed. Use as test fixture in M3.',
    _imo_used: imo,
    _provider: 'VesselFinder',
    _generated: new Date().toISOString(),
    _is_mock: !apiKey,
    data: rawJson,
  };
  fs.writeFileSync(samplePath, JSON.stringify(sampleData, null, 2));
  console.log(`\nSample fixture written to: ${samplePath}`);
}

main().catch((err: unknown) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
