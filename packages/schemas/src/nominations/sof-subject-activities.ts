import { z } from 'zod';

export const sofSubjectActivityInputSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .refine((s) => !/[\r\n]/.test(s), 'Use a single line'),
    eventNames: z.array(z.string().trim().min(1).max(160)).max(30).default([]),
    active: z.boolean().default(true),
  })
  .strict();
export type SofSubjectActivityInput = z.infer<typeof sofSubjectActivityInputSchema>;
export const sofSubjectActivitySchema = sofSubjectActivityInputSchema.extend({ id: z.string() });
export type SofSubjectActivity = z.infer<typeof sofSubjectActivitySchema>;
export const sofSubjectOptionsSchema = z.object({
  items: z.array(sofSubjectActivitySchema),
  suggestedId: z.string().nullable(),
});
export type SofSubjectOptions = z.infer<typeof sofSubjectOptionsSchema>;

export const DEFAULT_SOF_SUBJECT_LABELS = [
  'Arrival Times & Conditions',
  'Port Authorities / Agent On Board',
  'Clearance by Port Authorities',
  'Port Authorities Disembark',
  'Pilot On Board',
  'All Fast',
  'Key Meeting Details',
  'N.O.R. Accepted',
  'Commenced Loading',
  'Completed Loading',
  'Completed Calculation TRV',
  'Cargo Documents on Board',
  'Anchored Aw. Cargo Documents',
  'Anti-Narcotics Team / Divers',
  'Anti-Narcotics Team / Divers/ Agent Disembark',
  'Sailed Full Away',
] as const;

export function sofActivitySubject(base: string, label: string): string {
  return `${base
    .replace(/\s*::.*$/s, '')
    .replace(/\s*-\s*(?:Interim|Final) Statement of Facts\s*$/i, '')
    .trim()} :: ${label}`;
}

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Never fall back to an older matching event if the latest event is unknown or ambiguous. */
export function suggestSofSubjectActivity(
  items: SofSubjectActivity[],
  entries: { occurredAt: string | Date; activityName: string | null }[],
): string | null {
  if (!entries.length) return null;
  const latest = Math.max(...entries.map((e) => new Date(e.occurredAt).getTime()));
  if (!Number.isFinite(latest)) return null;
  const ids = entries
    .filter((e) => new Date(e.occurredAt).getTime() === latest)
    .map((entry) => {
      if (!entry.activityName) return null;
      const name = normalize(entry.activityName);
      const matches = items.filter(
        (item) =>
          item.active &&
          [item.label, ...item.eventNames].some((alias) => normalize(alias) === name),
      );
      return matches.length === 1 ? matches[0]!.id : null;
    });
  return ids.length > 0 && ids.every((id) => id !== null && id === ids[0]) ? ids[0]! : null;
}
