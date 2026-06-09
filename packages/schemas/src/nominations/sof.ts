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
// ---------------------------------------------------------------------------
// Sub-modal JSON schemas — stored as opaque blobs; structure validated here.
// ---------------------------------------------------------------------------

const BunkerRowSchema = z.object({
  arrival: z.string().nullable().optional(),
  sailing: z.string().nullable().optional(),
  lifted: z.string().nullable().optional(),
});
export const SofBunkersDataSchema = z.object({
  IFO: BunkerRowSchema.optional(),
  HSFO: BunkerRowSchema.optional(),
  LSFO: BunkerRowSchema.optional(),
  MDO: BunkerRowSchema.optional(),
  MGO: BunkerRowSchema.optional(),
  LSMGO: BunkerRowSchema.optional(),
  FW: BunkerRowSchema.optional(),
  VLSFO: BunkerRowSchema.optional(),
});

const DraftRowSchema = z.object({
  arrival: z.string().nullable().optional(),
  sailing: z.string().nullable().optional(),
});
export const SofDraftDataSchema = z.object({
  FWD: DraftRowSchema.optional(),
  AFT: DraftRowSchema.optional(),
});

const DynColsSchema = z.object({
  columns: z.array(z.string()).default([]),
  rows: z.record(z.array(z.string())).default({}),
});
export const SofParcelsDataSchema = DynColsSchema;
export const SofBlFiguresDataSchema = DynColsSchema;
export const SofShipFiguresDataSchema = DynColsSchema;

export const SofLettersDataSchema = z.object({
  items: z
    .array(
      z.object({
        from: z.string().default(''),
        to: z.string().default(''),
        comment: z.string().default(''),
      }),
    )
    .default([]),
});

export const SofRemarksDataSchema = z.object({
  items: z
    .array(
      z.object({
        remark: z.string().default(''),
        beginDate: z.string().default(''),
        beginTime: z.string().default(''),
        endDate: z.string().default(''),
        endTime: z.string().default(''),
        comment: z.string().default(''),
      }),
    )
    .default([]),
});

export const SofSlopDischargedDataSchema = z.object({
  rows: z
    .array(
      z.object({
        event: z.string(),
        date: z.string().default(''),
        time: z.string().default(''),
      }),
    )
    .default([]),
});

export type SofBunkersData = z.infer<typeof SofBunkersDataSchema>;
export type SofDraftData = z.infer<typeof SofDraftDataSchema>;
export type SofParcelsData = z.infer<typeof SofParcelsDataSchema>;
export type SofBlFiguresData = z.infer<typeof SofBlFiguresDataSchema>;
export type SofShipFiguresData = z.infer<typeof SofShipFiguresDataSchema>;
export type SofLettersData = z.infer<typeof SofLettersDataSchema>;
export type SofRemarksData = z.infer<typeof SofRemarksDataSchema>;
export type SofSlopDischargedData = z.infer<typeof SofSlopDischargedDataSchema>;

export const SofBunkersReceivedDataSchema = z.object({
  columns: z.array(z.string()).default([]),
  rows: z
    .array(
      z.object({
        event: z.string(),
        values: z.array(z.string()).default([]),
        water: z.string().default(''),
      }),
    )
    .default([]),
});

export type SofBunkersReceivedData = z.infer<typeof SofBunkersReceivedDataSchema>;

export const SofTimesheetInputSchema = z.object({
  lastPortId: z.string().nullable().optional(),
  nextPortId: z.string().nullable().optional(),
  pierId: z.string().nullable().optional(),
  captain: z.string().nullable().optional(),
  mobileOnBoard: z.string().nullable().optional(),
  entries: z.array(SofEntryInputSchema).default([]),
  bunkersData: SofBunkersDataSchema.nullable().optional(),
  draftData: SofDraftDataSchema.nullable().optional(),
  sofParcelsData: SofParcelsDataSchema.nullable().optional(),
  blFiguresData: SofBlFiguresDataSchema.nullable().optional(),
  shipFiguresData: SofShipFiguresDataSchema.nullable().optional(),
  lettersData: SofLettersDataSchema.nullable().optional(),
  remarksData: SofRemarksDataSchema.nullable().optional(),
  slopDischargedData: SofSlopDischargedDataSchema.nullable().optional(),
  bunkersReceivedData: SofBunkersReceivedDataSchema.nullable().optional(),
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
  bunkersData: SofBunkersDataSchema.nullable().optional(),
  draftData: SofDraftDataSchema.nullable().optional(),
  sofParcelsData: SofParcelsDataSchema.nullable().optional(),
  blFiguresData: SofBlFiguresDataSchema.nullable().optional(),
  shipFiguresData: SofShipFiguresDataSchema.nullable().optional(),
  lettersData: SofLettersDataSchema.nullable().optional(),
  remarksData: SofRemarksDataSchema.nullable().optional(),
  slopDischargedData: SofSlopDischargedDataSchema.nullable().optional(),
  bunkersReceivedData: SofBunkersReceivedDataSchema.nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});
export type SofTimesheetResponse = z.infer<typeof SofTimesheetResponseSchema>;
