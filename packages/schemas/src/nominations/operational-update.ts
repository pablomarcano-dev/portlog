import { z } from 'zod';
import { getUpdateSubjectParts } from './update-subject-time.js';

export const operationalUpdateModeSchema = z.enum(['ANCHOR', 'ALONGSIDE', 'CARGO']);
export type OperationalUpdateMode = z.infer<typeof operationalUpdateModeSchema>;

export const OPERATIONAL_UPDATE_LABELS: Record<OperationalUpdateMode, string> = {
  ANCHOR: 'Update at Anchor',
  ALONGSIDE: 'Update at Alongside',
  CARGO: 'Cargo Update',
};

/** These are draft-display options, never SOF updates. */
export const operationalUpdateComposeQuerySchema = z.object({
  mode: z.enum(['ANCHOR', 'ALONGSIDE']).optional(),
  at: z.string().datetime().optional(),
  automatic: z.enum(['true', 'false']).optional(),
});
export type OperationalUpdateComposeQuery = z.infer<typeof operationalUpdateComposeQuerySchema>;

export function operationalUpdateSubject(
  base: string,
  mode: OperationalUpdateMode,
  at: Date,
  automatic = true,
): string {
  const label = `${OPERATIONAL_UPDATE_LABELS[mode]} ${getUpdateSubjectParts(at, automatic).stamp}`;
  return base.trim() ? `${base.trim()} - ${label}` : label;
}

/** Explicit saved event names only; unknown/tied contradictory latest events need a choice. */
const EVENT_MODES: Record<string, OperationalUpdateMode | undefined> = {
  anchored: 'ANCHOR',
  'anchored aw. berth availability': 'ANCHOR',
  'anchored awaiting berth': 'ANCHOR',
  'all fast': 'ALONGSIDE',
  'completed loading': 'ALONGSIDE',
  'completed discharging': 'ALONGSIDE',
  'commenced loading': 'CARGO',
  'commenced discharging': 'CARGO',
};
export function suggestOperationalUpdateMode(
  events: readonly { occurredAt: Date | string; activityName: string | null }[],
): OperationalUpdateMode | null {
  if (!events.length) return null;
  const timed = events.map((event) => ({ ...event, time: new Date(event.occurredAt).getTime() }));
  if (timed.some((event) => !Number.isFinite(event.time))) return null;
  const latest = Math.max(...timed.map((event) => event.time));
  const modes = timed
    .filter((event) => event.time === latest)
    .map(
      (event) => EVENT_MODES[(event.activityName ?? '').trim().replace(/\s+/g, ' ').toLowerCase()],
    );
  const mode = modes[0];
  return mode && modes.every((other) => other === mode) ? mode : null;
}

/** Resolve a typed agency calendar/time through the configured timezone formatter. */
export function operationalUpdateInstant(date: Date, time: string): Date {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!match || !Number.isFinite(date.getTime())) throw new RangeError('Invalid update time.');
  const target = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number(match[1]),
    Number(match[2]),
  );
  let candidate = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = getUpdateSubjectParts(new Date(candidate), false);
    const [hour, minute] = parts.time.split(':').map(Number);
    const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, hour, minute);
    if (displayed === target) return new Date(candidate);
    candidate += target - displayed;
  }
  throw new RangeError('This local update time does not exist.');
}
