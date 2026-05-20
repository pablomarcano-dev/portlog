import type { RadiusVessel, VesselProData } from '@portlog/schemas';

export type VesselSource = 'radius' | 'fleet';

/** RadiusVessel enriched with ownership data + optional vessel_pro */
export interface EnrichedVessel extends RadiusVessel {
  beneficial_owner: string;
  operator_name: string;
  technical_manager: string;
  commercial_manager: string;
  source: VesselSource;
  pro?: VesselProData;
}

export function enrichVessel(
  vessel: RadiusVessel,
  ownership:
    | {
        beneficial_owner: string | null;
        operator: string | null;
        technical_manager: string | null;
        commercial_manager: string | null;
      }
    | undefined,
  options?: { source?: VesselSource; pro?: VesselProData },
): EnrichedVessel {
  return {
    ...vessel,
    beneficial_owner: ownership?.beneficial_owner ?? '—',
    operator_name: ownership?.operator ?? '—',
    technical_manager: ownership?.technical_manager ?? '—',
    commercial_manager: ownership?.commercial_manager ?? '—',
    source: options?.source ?? 'radius',
    pro: options?.pro,
  };
}
