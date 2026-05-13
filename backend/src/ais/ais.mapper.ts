import type { VesselFinderRaw } from '@portlog/schemas/ais';
import type { AisVessel } from '@portlog/schemas';

/**
 * mapVesselFinderToAisVessel — pure function that converts a validated
 * VesselFinderRaw object into the normalized AisVessel shape.
 *
 * Defensive about missing fields: inland vessels often omit dimensions,
 * position fixes may be absent for vessels in port with AIS off.
 */
export function mapVesselFinderToAisVessel(raw: VesselFinderRaw): AisVessel {
  return {
    imo: raw.imo,
    mmsi: raw.mmsi ?? null,
    name: raw.name,
    callSign: raw.callsign ?? null,
    flag: raw.flag ?? null,
    vesselType: raw.type_name ?? null,
    loa: raw.length ?? null,
    beam: raw.beam ?? null,
    draught: raw.draught ?? null,
    gt: raw.gt ?? null,
    dwt: raw.dwt ?? null,
    lastPosition: raw.position
      ? {
          lat: raw.position.lat,
          lon: raw.position.lon,
          sog: raw.position.speed ?? null,
          cog: raw.position.course ?? null,
          navStatus: raw.position.status ?? null,
          timestampUtc: raw.position.timestamp ?? null,
        }
      : null,
    eta: raw.eta ?? null,
    lastPort:
      raw.last_port != null
        ? {
            name: raw.last_port,
            unlocode: raw.last_port_unlocode ?? null,
          }
        : null,
    nextPort:
      raw.destination != null
        ? {
            name: raw.destination,
            unlocode: raw.destination_unlocode ?? null,
          }
        : null,
    provider: 'vesselfinder',
    fetchedAt: new Date().toISOString(),
  };
}
