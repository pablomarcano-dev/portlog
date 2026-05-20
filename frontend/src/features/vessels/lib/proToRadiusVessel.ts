import type { RadiusVessel, VesselProData } from '@portlog/schemas';
import { haversineNm } from './haversine';

/**
 * Synthesize a RadiusVessel-shaped record from vessel_pro data so that the
 * same classification logic (stationary / destination match) and table
 * columns work for fleet-sourced vessels.
 */
export function proToRadiusVessel(
  imo: string,
  pro: VesselProData,
  portLat: number,
  portLon: number,
): RadiusVessel | null {
  if (pro.lat == null || pro.lon == null) return null;

  const distance = haversineNm(portLat, portLon, pro.lat, pro.lon);

  return {
    uuid: `fleet:${imo}`,
    name: pro.name ?? '',
    mmsi: pro.mmsi ?? '',
    imo,
    country_iso: pro.country_iso ?? '',
    type: pro.type ?? '',
    type_specific: pro.type_specific ?? '',
    lat: pro.lat,
    lon: pro.lon,
    speed: pro.speed ?? 0,
    course: pro.course ?? 0,
    heading: pro.heading ?? 0,
    navigation_status: pro.navigation_status ?? '',
    destination: pro.destination ?? '',
    last_position_epoch: pro.last_position_epoch ?? 0,
    last_position_UTC: pro.last_position_UTC ?? '',
    eta_epoch: pro.eta_epoch,
    eta_UTC: pro.eta_UTC,
    distance,
  };
}
