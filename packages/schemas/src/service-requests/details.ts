import { z } from 'zod';
import { clearableCuid } from '../common/fields.js';
import { flag, optionalTextField, requiredNumber, requiredTextField } from './fields.js';
import {
  AUTHORIZATION_REQUIRED_LAUNCH_TYPES,
  choice,
  BallastAnalysisTypeSchema,
  LaunchServiceTypeSchema,
  MAX_TUGS,
  StsRoleSchema,
  TugOperationTypeSchema,
  UnderwaterInspectionTypeSchema,
  UnderwaterMethodSchema,
} from './enums.js';

// ---------------------------------------------------------------------------
// Service Requests — the per-type `details` payload
// ---------------------------------------------------------------------------
// Everything the five forms share (vessel, branch, provider, location,
// scheduled time, authorisation upload, voucher number, observations, billing)
// lives in real columns on `service_requests`. This file holds only what is
// genuinely type-specific, as a Zod discriminated union stored in `details Json`
// — the same shape `SHDocumentDataSchema` uses for SH-xx documents.
//
// Every field carries an explicit message. The defaults ("Required", "Expected
// number, received nan") surface verbatim under the input, and an operator
// transcribing a paper form needs to be told which box is wrong, not which
// TypeScript type failed.
//
// Note what is deliberately NOT here:
//   - the scheduled datetime. The specs name it four ways ("Hora de Zarpe",
//     "Fecha y Hora Estimada de Inicio", "Fecha y Hora Programada", "Hora de
//     Maniobra / Pilot on Board") but it is one field; it is the `scheduledAt`
//     column, relabelled per type in the UI. Keeping it a column is what lets
//     the list screen sort and filter across all six types.
//   - the vessel location. Same reasoning — the `location` column.
// ---------------------------------------------------------------------------

/**
 * Deliverables checklists. Two forms request them with different option sets;
 * each type declares its own object rather than sharing one loose shape, so an
 * impossible combination (live CCTV on a ballast analysis) cannot be stored.
 */
const UnderwaterDeliverablesSchema = z.object({
  liveCctv: flag('Live CCTV'),
  photos: flag('Photos'),
  technicalReport: flag('Technical report'),
});

const BallastDeliverablesSchema = z.object({
  photos: flag('Photos'),
  technicalReport: flag('Technical report'),
});

// ---------------------------------------------------------------------------
// LAUNCH — Launch Boat Services
// ---------------------------------------------------------------------------
export const LaunchDetailsSchema = z.object({
  type: z.literal('LAUNCH'),
  serviceType: choice(LaunchServiceTypeSchema, 'Select a launch service type'),
  /** Defaults to 1 per the spec, but the operator may order a second boat. */
  boatCount: requiredNumber({
    missing: 'Enter how many boats are required',
    notANumber: 'Number of boats must be a number',
  })
    .pipe(
      z
        .number()
        .int('Number of boats must be a whole number')
        .min(1, 'At least one boat is required')
        .max(20, 'More than 20 boats is not a valid order — split it into several requests'),
    )
    .default(1),
  /** Free text; not every departure point is a Port row. */
  departurePoint: optionalTextField(200, 'Departure point'),
});

// ---------------------------------------------------------------------------
// UNDERWATER_INSPECTION — Underwater Technical Inspection
// ---------------------------------------------------------------------------
export const UnderwaterDetailsSchema = z.object({
  type: z.literal('UNDERWATER_INSPECTION'),
  inspectionType: choice(UnderwaterInspectionTypeSchema, 'Select an inspection type'),
  method: choice(UnderwaterMethodSchema, 'Select a method').default('COMMERCIAL_DIVERS'),
  deliverables: UnderwaterDeliverablesSchema.default({
    liveCctv: false,
    photos: false,
    technicalReport: false,
  }),
});

// ---------------------------------------------------------------------------
// BALLAST_WATER — Ballast Water Inspection
// ---------------------------------------------------------------------------
export const BallastWaterDetailsSchema = z.object({
  type: z.literal('BALLAST_WATER'),
  analysisType: choice(BallastAnalysisTypeSchema, 'Select a service or analysis type'),
  tankCount: requiredNumber({
    missing: 'Enter how many tanks are to be inspected',
    notANumber: 'Number of tanks must be a number',
  }).pipe(
    z
      .number()
      .int('Number of tanks must be a whole number')
      .min(1, 'At least one tank must be inspected')
      .max(100, 'No vessel has more than 100 ballast tanks — check the figure'),
  ),
  requiresCertifiedLab: flag('Certified laboratory'),
  deliverables: BallastDeliverablesSchema.default({ photos: false, technicalReport: false }),
});

// ---------------------------------------------------------------------------
// TUG — Tug Services
// ---------------------------------------------------------------------------
export const TugDetailsSchema = z.object({
  type: z.literal('TUG'),
  operationType: choice(TugOperationTypeSchema, 'Select a manoeuvre type'),
  tugCount: requiredNumber({
    missing: 'Enter how many tugs are required',
    notANumber: 'Number of tugs must be a number',
  })
    .pipe(
      z
        .number()
        .int('Number of tugs must be a whole number')
        .min(1, 'At least one tug is required')
        .max(MAX_TUGS, `No more than ${MAX_TUGS} tugs may be ordered on one request`),
    )
    .default(1),
});

// ---------------------------------------------------------------------------
// STS — Ship-to-Ship Operation
// ---------------------------------------------------------------------------
// The equipment / spill-prevention / personnel checklists stay three separate
// objects so the purchase order can print them under their own headings, the
// way the provider expects to read them.
// ---------------------------------------------------------------------------
export const StsDetailsSchema = z.object({
  type: z.literal('STS'),
  /** Free text: the counterparty is not in our vessel registry. */
  targetVesselName: requiredTextField(200, {
    missing: 'Enter the target vessel name',
    tooLong: 'Target vessel name must be 200 characters or fewer',
  }),
  ourRole: choice(StsRoleSchema, 'Select the role our vessel plays'),
  /** Split from the quantity so the figure stays numeric and reportable. */
  product: requiredTextField(200, {
    missing: 'Enter the product being transferred',
    tooLong: 'Product must be 200 characters or fewer',
  }),
  quantity: requiredNumber({
    missing: 'Enter the quantity to be transferred',
    notANumber: 'Quantity must be a number',
  }).pipe(z.number().positive('Quantity must be greater than zero')),
  quantityUnit: requiredTextField(20, {
    missing: 'Enter the unit of measure, e.g. BBL',
    tooLong: 'Unit must be 20 characters or fewer',
  }).default('BBL'),
  equipment: z
    .object({ fenders: flag('Fenders'), hoses: flag('Hoses'), reducers: flag('Reducers') })
    .default({ fenders: false, hoses: false, reducers: false }),
  spillPrevention: z
    .object({ floatingBarriers: flag('Floating barriers'), watchBoat: flag('Watch boat') })
    .default({ floatingBarriers: false, watchBoat: false }),
  personnel: z
    .object({
      mooringMaster: flag('Mooring master'),
      connectionTechnicians: flag('Connection technicians'),
    })
    .default({ mooringMaster: false, connectionTechnicians: false }),
});

// ---------------------------------------------------------------------------
// GENERAL — the ad-hoc paper service voucher
// ---------------------------------------------------------------------------
// Carries what the deprecated nomination `Sale` held and nothing else fits: the
// route driven, the catalogue service, and the two people named on the slip
// (driver / user, both rows in the shared SalesContact directory).
// ---------------------------------------------------------------------------
export const GeneralDetailsSchema = z.object({
  type: z.literal('GENERAL'),
  /** The route covered, e.g. "Guaraguao - Muelle 3". */
  route: optionalTextField(500, 'Route'),
  /** Reference into the `Service` catalogue. */
  serviceId: clearableCuid(),
  /** The driver named on the slip. */
  driverId: clearableCuid(),
  /** Whoever received the service; not a Portlog account. */
  userId: clearableCuid(),
});

export const ServiceRequestDetailsSchema = z.discriminatedUnion(
  'type',
  [
    LaunchDetailsSchema,
    UnderwaterDetailsSchema,
    BallastWaterDetailsSchema,
    TugDetailsSchema,
    StsDetailsSchema,
    GeneralDetailsSchema,
  ],
  { errorMap: () => ({ message: 'Unrecognised service request type' }) },
);
export type ServiceRequestDetails = z.infer<typeof ServiceRequestDetailsSchema>;

/**
 * Does this request need an authority authorisation letter before the purchase
 * order may be sent?
 *
 * Three of the forms make the upload unconditionally mandatory. Launch services
 * make it conditional on the service type. Tugs and the general voucher never
 * need one. Callers pass whatever they have — an unparsed `details` blob is
 * treated as "not required" rather than throwing, because this is also
 * consulted while a half-filled draft is being edited.
 */
export function requiresAuthorizationDocument(details: unknown): boolean {
  const parsed = ServiceRequestDetailsSchema.safeParse(details);
  if (!parsed.success) return false;
  const value = parsed.data;

  switch (value.type) {
    case 'UNDERWATER_INSPECTION':
    case 'BALLAST_WATER':
    case 'STS':
      return true;
    case 'LAUNCH':
      return AUTHORIZATION_REQUIRED_LAUNCH_TYPES.includes(value.serviceType);
    case 'TUG':
    case 'GENERAL':
      return false;
  }
}
