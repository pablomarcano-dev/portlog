import type { RadiusVessel, VesselProData } from '@portlog/schemas';

export type VesselCategory = 'fondeado' | 'arribo' | 'zarpe';

export interface CategorizeContext {
  portName: string;
  portUnlocode?: string | null;
  terminalName?: string;
  pro?: VesselProData;
}

const STATIONARY_STATUSES = new Set(['Moored', 'At anchor', 'Not under command', 'Aground']);

const EXCLUDED_VESSEL_TYPES = new Set([
  'navigation aid',
  'pilot vessel',
  'search and rescue',
  'port tender',
  'law enforcement',
  'spare',
  'military',
]);

export function isRelevantVessel(vessel: RadiusVessel): boolean {
  if (!vessel.imo || vessel.imo === '0') return false;
  const type = (vessel.type || '').toLowerCase();
  const typeSpecific = (vessel.type_specific || '').toLowerCase();
  for (const excluded of EXCLUDED_VESSEL_TYPES) {
    if (type.includes(excluded) || typeSpecific.includes(excluded)) return false;
  }
  return true;
}

/**
 * Try to match an AIS destination string against a port/terminal identifier.
 * Handles three real-world quirks:
 *   - AIS destinations often use "LAST > NEXT" (or "LAST-NEXT", "LAST/NEXT");
 *     only the NEXT side matters.
 *   - Short tokens (< 3 chars) are noise and cause false positives.
 *   - Captains abbreviate ("JOSE TERM" vs "Jose Terminal") — compare both
 *     whole-string and token-level.
 */
function destinationMatches(destination: string, candidate: string): boolean {
  if (!destination || !candidate) return false;
  const parts = destination.split(/[>\-/]/);
  const next = (parts[parts.length - 1] ?? destination).trim().toUpperCase();
  const cand = candidate.trim().toUpperCase();
  if (next.length < 3 || cand.length < 3) return false;
  if (next.includes(cand) || cand.includes(next)) return true;

  const tokens = (s: string): string[] => s.split(/[^A-Z0-9]+/).filter((t) => t.length >= 3);
  const nextTokens = tokens(next);
  const candTokens = tokens(cand);
  return nextTokens.some((t) => candTokens.includes(t));
}

export function categorizeVessel(vessel: RadiusVessel, ctx: CategorizeContext): VesselCategory {
  const { portName, portUnlocode, terminalName, pro } = ctx;

  const speed = pro?.speed ?? vessel.speed;
  const navStatus = pro?.navigation_status ?? vessel.navigation_status;
  const isStationary =
    (typeof speed === 'number' && speed < 1.0) ||
    (!!navStatus && STATIONARY_STATUSES.has(navStatus));

  if (isStationary) return 'fondeado';

  // Best signal: vessel_pro normalized fields
  if (pro?.dest_port_unlocode && portUnlocode) {
    if (pro.dest_port_unlocode.toUpperCase() === portUnlocode.toUpperCase()) {
      return 'arribo';
    }
  }
  if (pro?.dest_port) {
    if (destinationMatches(pro.dest_port, portName)) return 'arribo';
    if (terminalName && destinationMatches(pro.dest_port, terminalName)) {
      return 'arribo';
    }
  }

  // Fallback: raw AIS destination text
  const dest = vessel.destination || '';
  if (destinationMatches(dest, portName)) return 'arribo';
  if (terminalName && destinationMatches(dest, terminalName)) return 'arribo';
  if (portUnlocode && destinationMatches(dest, portUnlocode)) return 'arribo';

  return 'zarpe';
}
