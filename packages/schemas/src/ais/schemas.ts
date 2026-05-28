import { z } from 'zod';

// ---------------------------------------------------------------------------
// Internal: raw VesselFinder API response shape (NOT re-exported from package root)
// Used only in backend/src/ais/ to validate the untrusted external response
// before mapping to AisVessel. Golden Rule 10: validate all external data.
// ---------------------------------------------------------------------------

const VesselFinderPositionSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  speed: z.number().nullable().optional(),
  course: z.number().nullable().optional(),
  heading: z.number().nullable().optional(),
  status: z.number().nullable().optional(),
  timestamp: z.string().nullable().optional(),
});

/**
 * VesselFinderRawResponseSchema — mirrors the structure returned by:
 *   GET https://api.vf-api.com/v2/vessels?imo={imo}
 *
 * The `data` wrapper is how the fixture is shaped; the actual VesselFinder
 * response may return the vessel object directly or wrapped. The client
 * unwraps before parsing this schema.
 *
 * NOT exported from the package root index — only consumed internally.
 */
export const VesselFinderRawResponseSchema = z.object({
  imo: z.string(),
  mmsi: z.string().nullable().optional(),
  name: z.string(),
  callsign: z.string().nullable().optional(),
  flag: z.string().nullable().optional(),
  type: z.number().nullable().optional(),
  type_name: z.string().nullable().optional(),
  length: z.number().positive().nullable().optional(),
  beam: z.number().positive().nullable().optional(),
  draught: z.number().positive().nullable().optional(),
  gt: z.number().int().positive().nullable().optional(),
  dwt: z.number().int().positive().nullable().optional(),
  position: VesselFinderPositionSchema.nullable().optional(),
  eta: z.string().nullable().optional(),
  last_port: z.string().nullable().optional(),
  last_port_unlocode: z.string().nullable().optional(),
  destination: z.string().nullable().optional(),
  destination_unlocode: z.string().nullable().optional(),
});

export type VesselFinderRaw = z.infer<typeof VesselFinderRawResponseSchema>;

// ---------------------------------------------------------------------------
// Public: normalized AisVessel shape consumed by frontend in M3-S6
// ---------------------------------------------------------------------------

const AisPositionSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  /** Speed over ground, knots */
  sog: z.number().nullable(),
  /** Course over ground, degrees */
  cog: z.number().nullable(),
  /** AIS navigational status code (0=underway, 1=anchored, etc.) */
  navStatus: z.number().nullable(),
  /** ISO 8601 UTC timestamp of the position fix */
  timestampUtc: z.string().nullable(),
});

export const AisVesselSchema = z.object({
  /** 7-digit IMO number */
  imo: z.string().regex(/^\d{7}$/, 'IMO must be exactly 7 digits'),
  /** 9-digit MMSI, nullable (some vessels omit) */
  mmsi: z
    .string()
    .regex(/^\d{9}$/, 'MMSI must be exactly 9 digits')
    .nullable(),
  name: z.string(),
  callSign: z.string().nullable(),
  /** ISO 3166-1 alpha-2 country code */
  flag: z.string().nullable(),
  vesselType: z.string().nullable(),
  /** Length overall, metres — nullable (inland vessels often omit) */
  loa: z.number().positive().nullable(),
  beam: z.number().positive().nullable(),
  draught: z.number().positive().nullable(),
  /** Gross tonnage */
  gt: z.number().int().positive().nullable(),
  /** Deadweight tonnage */
  dwt: z.number().int().positive().nullable(),
  lastPosition: AisPositionSchema.nullable(),
  /** ETA as ISO 8601 UTC string, as reported by vessel transponder */
  eta: z.string().nullable(),
  lastPort: z
    .object({
      name: z.string(),
      unlocode: z.string().nullable(),
    })
    .nullable(),
  nextPort: z
    .object({
      name: z.string(),
      unlocode: z.string().nullable(),
    })
    .nullable(),
  /** Data provider */
  provider: z.enum(['vesselfinder', 'datalastic']),
  /** ISO 8601 UTC timestamp of when this record was fetched */
  fetchedAt: z.string(),
});

export type AisVessel = z.infer<typeof AisVesselSchema>;
