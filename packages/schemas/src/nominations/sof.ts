import { z } from 'zod';

// ---------------------------------------------------------------------------
// SofEntryInput — a single activity row in the SOF timesheet
// occurredAt is ISO 8601 datetime string; frontend combines date+time before sending.
// order is 0-based display ordering managed by the caller.
// ---------------------------------------------------------------------------
export const SofEntryInputSchema = z.object({
  occurredAt: z.string().datetime(),
  activityId: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  order: z.number().int().nonnegative(),
});
export type SofEntryInput = z.infer<typeof SofEntryInputSchema>;

// ---------------------------------------------------------------------------
// SofTimesheetInput — full payload for PUT /nominations/:id/sof
// All header fields are nullable (not required — can be saved partially).
// entries replaces all existing rows (full replace, not patch).
// ---------------------------------------------------------------------------
export const SofTimesheetInputSchema = z.object({
  lastPortId: z.string().nullable().optional(),
  nextPortId: z.string().nullable().optional(),
  pierId: z.string().nullable().optional(),
  captain: z.string().nullable().optional(),
  mobileOnBoard: z.string().nullable().optional(),
  entries: z.array(SofEntryInputSchema).default([]),
});
export type SofTimesheetInput = z.infer<typeof SofTimesheetInputSchema>;

// ---------------------------------------------------------------------------
// SofTimesheetResponse — shape returned by GET /nominations/:id/sof
// When no timesheet exists yet, returns a prefilled default (no id field).
// ---------------------------------------------------------------------------
const SofPortSummarySchema = z.object({ id: z.string(), name: z.string() }).nullable();
const SofPierSummarySchema = z.object({ id: z.string(), name: z.string() }).nullable();
const SofActivitySummarySchema = z.object({ id: z.string(), name: z.string() }).nullable();

export const SofEntryResponseSchema = z.object({
  id: z.string(),
  sofTimesheetId: z.string(),
  occurredAt: z.coerce.date(),
  activityId: z.string().nullable(),
  activity: SofActivitySummarySchema,
  comment: z.string().nullable(),
  order: z.number(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type SofEntryResponse = z.infer<typeof SofEntryResponseSchema>;

export const SofTimesheetResponseSchema = z.object({
  id: z.string().optional(), // absent when prefilled default (not yet saved)
  nominationId: z.string().optional(),
  lastPortId: z.string().nullable(),
  lastPort: SofPortSummarySchema,
  nextPortId: z.string().nullable(),
  nextPort: SofPortSummarySchema,
  pierId: z.string().nullable(),
  pier: SofPierSummarySchema,
  captain: z.string().nullable(),
  mobileOnBoard: z.string().nullable(),
  entries: z.array(SofEntryResponseSchema),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type SofTimesheetResponse = z.infer<typeof SofTimesheetResponseSchema>;
