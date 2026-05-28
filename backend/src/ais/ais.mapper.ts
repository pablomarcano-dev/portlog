import type { AisVessel } from '@portlog/schemas';

/** Minimal shape of the `data` object from Datalastic vessel_pro endpoint */
export interface VesselProData {
  imo: string;
  mmsi?: string | null;
  name?: string | null;
  country_iso?: string | null;
  type?: string | null;
  lat?: number | null;
  lon?: number | null;
  speed?: number | null;
  course?: number | null;
  navigation_status?: number | null;
  last_position_UTC?: string | null;
  eta_UTC?: string | null;
  dep_port?: string | null;
  dep_port_unlocode?: string | null;
  dest_port?: string | null;
  dest_port_unlocode?: string | null;
}

export function mapDatalasticToAisVessel(data: VesselProData): AisVessel {
  const hasPosition = data.lat != null && data.lon != null;

  return {
    imo: data.imo,
    mmsi: data.mmsi ?? null,
    name: data.name ?? data.imo,
    callSign: null,
    flag: data.country_iso ?? null,
    vesselType: data.type ?? null,
    loa: null,
    beam: null,
    draught: null,
    gt: null,
    dwt: null,
    lastPosition: hasPosition
      ? {
          lat: data.lat as number,
          lon: data.lon as number,
          sog: data.speed ?? null,
          cog: data.course ?? null,
          navStatus: data.navigation_status ?? null,
          timestampUtc: data.last_position_UTC ?? null,
        }
      : null,
    eta: data.eta_UTC ?? null,
    lastPort:
      data.dep_port != null
        ? { name: data.dep_port, unlocode: data.dep_port_unlocode ?? null }
        : null,
    nextPort:
      data.dest_port != null
        ? { name: data.dest_port, unlocode: data.dest_port_unlocode ?? null }
        : null,
    provider: 'datalastic',
    fetchedAt: new Date().toISOString(),
  };
}
