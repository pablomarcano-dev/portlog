import { NominationStatus } from './enums.js';

// ---------------------------------------------------------------------------
// Derived nomination status — single source of truth for the lifecycle.
//
// Status is not a manual state machine; it reflects reality computed from a few
// facts every time a nomination is read:
//   - NOMINATED : the default, once the nomination is created
//   - IN_PORT   : the prearrival message was sent AND we are past layDaysFirst
//   - FULL_AWAY : the final SOF was sent AND we are past layDaysLast
//   - CANCELLED : a manual override (persisted) that wins over everything above
//
// Null laydays dates mean the corresponding window has not been reached, so the
// nomination cannot advance past NOMINATED / IN_PORT on that account.
// ---------------------------------------------------------------------------
export interface NominationStatusFacts {
  /** Persisted cancellation flag — wins over all derived values. */
  cancelled: boolean;
  /** A PREARRIVAL email dispatch has been sent for this nomination. */
  prearrivalSent: boolean;
  /** A final SOF email dispatch has been sent for this nomination. */
  sofSent: boolean;
  layDaysFirst: Date | null;
  layDaysLast: Date | null;
  /** Reference "now" for the date comparisons. */
  now: Date;
}

export function deriveNominationStatus(f: NominationStatusFacts): NominationStatus {
  if (f.cancelled) return 'CANCELLED';
  if (f.sofSent && f.layDaysLast != null && f.now > f.layDaysLast) return 'FULL_AWAY';
  if (f.prearrivalSent && f.layDaysFirst != null && f.now > f.layDaysFirst) return 'IN_PORT';
  return 'NOMINATED';
}
