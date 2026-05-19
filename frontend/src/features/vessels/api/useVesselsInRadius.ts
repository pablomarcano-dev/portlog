import { useDatalastic } from './useDatalastic';
import type { RadiusVessel, VesselInRadiusResponse } from '@portlog/schemas';

/**
 * Fetches vessels within a radius of a given lat/lon via vessel_inradius.
 * Only enabled when lat, lon, and radius are provided.
 */
export function useVesselsInRadius(
  lat: number | null,
  lon: number | null,
  radius: number,
): { vessels: RadiusVessel[]; isLoading: boolean; isError: boolean } {
  const enabled = lat !== null && lon !== null && radius > 0;

  const { data, isLoading, isError } = useDatalastic<VesselInRadiusResponse>(
    'vessel_inradius',
    enabled
      ? {
          lat: String(lat),
          lon: String(lon),
          radius: String(radius),
        }
      : {},
    { enabled },
  );

  return {
    vessels: data?.vessels ?? [],
    isLoading,
    isError,
  };
}
