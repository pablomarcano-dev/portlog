import {
  ServiceRequestCreateSchema,
  type ServiceRequestDetails,
  type ServiceRequestRead,
  type ServiceRequestType,
} from '@portlog/schemas';
import type { z } from 'zod';

/** Return the next whole local hour, avoiding an accidental midnight default. */
export function defaultScheduledAt(now = new Date()): Date {
  const result = new Date(now);
  result.setMinutes(0, 0, 0);
  result.setHours(result.getHours() + 1);
  return result;
}

/** Combine a native time-input value with the date already chosen in the picker. */
export function withTime(date: Date | null, time: string): Date | null {
  if (!date || !/^\d{2}:\d{2}(?::\d{2})?$/.test(time)) return date;

  const parts = time.split(':').map(Number);
  const hours = parts[0] as number;
  const minutes = parts[1] as number;
  const seconds = parts[2] ?? 0;
  if (hours > 23 || minutes > 59 || seconds > 59) return date;

  const result = new Date(date);
  result.setHours(hours, minutes, seconds, 0);
  return result;
}

export function isMidnight(date: unknown): date is Date {
  return date instanceof Date && date.getHours() === 0 && date.getMinutes() === 0;
}

/**
 * The stepper's form shape. `z.input` rather than `z.infer`: the resolver sees
 * what the user typed (a possibly-empty picker, a numeric string), and the
 * schema's coercions and defaults produce the output shape on submit.
 */
export type ServiceRequestFormValues = z.input<typeof ServiceRequestCreateSchema>;

/**
 * A fresh `details` payload per type, pre-filled with the defaults the specs
 * state (boat count defaults to 1, method defaults to commercial divers).
 *
 * Every checklist flag is written out rather than left to the schema default,
 * because react-hook-form needs the key present up front to register the
 * checkbox as controlled.
 */
export function blankDetails(type: ServiceRequestType): ServiceRequestDetails {
  switch (type) {
    case 'LAUNCH':
      return { type, serviceType: undefined as never, boatCount: 1, departurePoint: undefined };
    case 'UNDERWATER_INSPECTION':
      return {
        type,
        inspectionType: undefined as never,
        method: 'COMMERCIAL_DIVERS',
        deliverables: { liveCctv: false, photos: false, technicalReport: false },
      };
    case 'BALLAST_WATER':
      return {
        type,
        analysisType: undefined as never,
        tankCount: undefined as never,
        requiresCertifiedLab: false,
        deliverables: { photos: false, technicalReport: false },
      };
    case 'TUG':
      return { type, operationType: undefined as never, tugCount: 1 };
    case 'STS':
      return {
        type,
        targetVesselName: '',
        ourRole: undefined as never,
        product: '',
        quantity: undefined as never,
        quantityUnit: 'BBL',
        equipment: { fenders: false, hoses: false, reducers: false },
        spillPrevention: { floatingBarriers: false, watchBoat: false },
        personnel: { mooringMaster: false, connectionTechnicians: false },
      };
    case 'GENERAL':
      return { type, route: undefined, serviceId: null, driverId: null, userId: null };
  }
}

/**
 * Defaults for a brand-new request.
 *
 * `branchId` comes from the signed-in user (the spec's "branch loads from the user")
 * but the field stays editable, so an agent covering another branch is not
 * blocked. Scheduling starts at the next whole hour: it is quick to adjust and
 * avoids silently inheriting 00:00 when the operator selects only a date.
 */
export function blankServiceRequest(
  type: ServiceRequestType,
  branchId: string | null,
): ServiceRequestFormValues {
  return {
    type,
    shipParticularId: '',
    branchId: branchId ?? '',
    nominationId: '',
    supplierId: null,
    location: null,
    portId: null,
    pierId: null,
    scheduledAt: defaultScheduledAt(),
    completedAt: null,
    physicalVoucherNo: undefined,
    notes: undefined,
    details: blankDetails(type),
    billToClientId: null,
    estimatedCost: null,
    actualCost: null,
    currency: 'VES',
  };
}

/** Map a loaded request back into form values for the edit flow. */
export function toFormValues(request: ServiceRequestRead): ServiceRequestFormValues {
  return {
    type: request.type,
    shipParticularId: request.shipParticularId ?? '',
    branchId: request.branchId,
    nominationId: request.nominationId ?? '',
    supplierId: request.supplierId,
    location: request.location,
    portId: request.portId,
    pierId: request.pierId,
    scheduledAt: request.scheduledAt,
    completedAt: request.completedAt,
    physicalVoucherNo: request.physicalVoucherNo ?? undefined,
    notes: request.notes ?? undefined,
    details: request.details,
    billToClientId: request.billToClientId,
    estimatedCost: request.estimatedCost,
    actualCost: request.actualCost,
    currency: request.currency,
  };
}
