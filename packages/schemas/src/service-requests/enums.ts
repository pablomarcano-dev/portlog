import { z } from 'zod';

// ---------------------------------------------------------------------------
// Service Requests — enums
// ---------------------------------------------------------------------------
// Every enum here mirrors a dropdown in the agency's five service request specs
// (the Lanchaje, Subacuáticas, Agua de Lastre, Remolcadores and STS documents,
// referenced by their original titles). Values are stored
// as stable SCREAMING_SNAKE codes so a wording change never rewrites stored rows.
//
// Each label carries BOTH languages:
//   `en` — the Portlog UI, which is English throughout.
//   `es` — the Orden de Compra PDF only. That document is read by Venezuelan
//          launch, tug and diving providers; sending it in English would be a
//          functional regression, and the surrounding branch-document templates
//          (antidrogas.hbs, solicitud-zarpe.hbs …) are Spanish for the same
//          reason. Use `labelEn` / `labelEs` rather than indexing directly.
// ---------------------------------------------------------------------------

/**
 * Re-declare an enum with a message that names the field.
 *
 * Zod reports "Invalid enum value, expected 'A' | 'B' | …" for a cleared
 * dropdown, which is unreadable under an input. The enum schemas below are
 * already constructed, so this rebuilds from their own `.options` tuple.
 */
export function choice<T extends [string, ...string[]]>(
  schema: z.ZodEnum<T>,
  message: string,
): z.ZodEnum<T> {
  return z.enum(schema.options, { errorMap: () => ({ message }) });
}

/** A term the UI and the provider-facing document each need in their own language. */
export interface BilingualLabel {
  en: string;
  es: string;
}

export function labelEn<K extends string>(labels: Record<K, BilingualLabel>, key: K): string {
  return labels[key].en;
}

export function labelEs<K extends string>(labels: Record<K, BilingualLabel>, key: K): string {
  return labels[key].es;
}

/** Mantine `Select` data, preserving declaration order. English, for the UI. */
export function toSelectOptions<K extends string>(
  labels: Record<K, BilingualLabel>,
): Array<{ value: K; label: string }> {
  return (Object.entries(labels) as Array<[K, BilingualLabel]>).map(([value, label]) => ({
    value,
    label: label.en,
  }));
}

/**
 * Which of the five request forms this row is. `GENERAL` is the sixth, catch-all
 * variant: it carries the ad-hoc paper service voucher (TRANSPORT AND SERVICES
 * MARINE) that the deprecated nomination `Sale` used to hold. The table backing
 * that flow is gone; the flow itself is still daily agency practice.
 */
export const ServiceRequestTypeSchema = z.enum([
  'LAUNCH',
  'UNDERWATER_INSPECTION',
  'BALLAST_WATER',
  'TUG',
  'STS',
  'GENERAL',
]);
export type ServiceRequestType = z.infer<typeof ServiceRequestTypeSchema>;

export const SERVICE_REQUEST_TYPE_LABELS: Record<ServiceRequestType, BilingualLabel> = {
  LAUNCH: { en: 'Launch Boat Services', es: 'Servicios de Lanchaje' },
  UNDERWATER_INSPECTION: {
    en: 'Underwater Technical Inspection',
    es: 'Inspección Técnica Subacuática',
  },
  BALLAST_WATER: { en: 'Ballast Water Inspection', es: 'Inspección de Agua de Lastre' },
  TUG: { en: 'Tug Services', es: 'Servicio de Remolcadores' },
  STS: { en: 'STS Operation (Ship-to-Ship)', es: 'Operación STS (Ship-to-Ship)' },
  GENERAL: { en: 'General Service', es: 'Servicio General' },
};

/**
 * DRAFT     — being filled in; everything editable.
 * SENT      — the purchase order was generated and emailed to the provider.
 *             Operational fields lock; reconciliation fields stay open.
 * COMPLETED — service performed and the physical voucher reconciled.
 * CANCELLED — reachable from DRAFT or SENT.
 */
export const ServiceRequestStatusSchema = z.enum(['DRAFT', 'SENT', 'COMPLETED', 'CANCELLED']);
export type ServiceRequestStatus = z.infer<typeof ServiceRequestStatusSchema>;

export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, BilingualLabel> = {
  DRAFT: { en: 'Draft', es: 'Borrador' },
  SENT: { en: 'Sent', es: 'Enviada' },
  COMPLETED: { en: 'Completed', es: 'Completada' },
  CANCELLED: { en: 'Cancelled', es: 'Anulada' },
};

/**
 * Where the vessel is. Shared by four of the five forms with slightly different
 * option lists; this is their union: the launch form adds a pilot station and a
 * buoy, the technical forms add an oil terminal.
 */
export const ServiceLocationSchema = z.enum([
  'ANCHORAGE',
  'BERTH',
  'BUOY',
  'PILOT_STATION',
  'OIL_TERMINAL',
  'OTHER',
]);
export type ServiceLocation = z.infer<typeof ServiceLocationSchema>;

export const SERVICE_LOCATION_LABELS: Record<ServiceLocation, BilingualLabel> = {
  ANCHORAGE: { en: 'Anchorage', es: 'Fondeo' },
  BERTH: { en: 'Berth', es: 'Muelle' },
  BUOY: { en: 'Buoy', es: 'Boya' },
  PILOT_STATION: { en: 'Pilot Station', es: 'Zona de Prácticos' },
  OIL_TERMINAL: { en: 'Oil Terminal', es: 'Terminal Petrolera' },
  OTHER: { en: 'Other', es: 'Otra' },
};

// ---------------------------------------------------------------------------
// LAUNCH — service type
// ---------------------------------------------------------------------------
// The spec lists nine options, including two near-duplicate pairs that differ
// only by "(Asignada)" / "(Assigned)". That is not a typo in the source: an
// assigned boat is one the maritime authority assigns, and those are exactly the
// ones that require an authority authorisation letter — see
// AUTHORIZATION_REQUIRED_LAUNCH_TYPES.
// ---------------------------------------------------------------------------
export const LaunchServiceTypeSchema = z.enum([
  'CREW_TRANSPORT',
  'ASSIGNED_PILOT_BOAT',
  'ASSIGNED_LEGAL_VISIT_BOAT',
  'ASSIGNED_INSPECTION_BOAT',
  'LEGAL_VISIT_BOAT',
  'INSPECTION_BOAT',
  'MOORING_ASSISTANCE',
  'GARBAGE_MARPOL',
  'SUPPLIES_SPARES',
]);
export type LaunchServiceType = z.infer<typeof LaunchServiceTypeSchema>;

export const LAUNCH_SERVICE_TYPE_LABELS: Record<LaunchServiceType, BilingualLabel> = {
  CREW_TRANSPORT: {
    en: 'Personnel / Crew Transfer',
    es: 'Transporte para traslado de Personal / Tripulación',
  },
  ASSIGNED_PILOT_BOAT: {
    en: 'Pilot Boat (Assigned)',
    es: 'Lancha para Pilotaje (Asignada)',
  },
  ASSIGNED_LEGAL_VISIT_BOAT: {
    en: 'Statutory Visit Boat (Assigned)',
    es: 'Lancha para Visita de Ley (Asignada)',
  },
  ASSIGNED_INSPECTION_BOAT: {
    en: 'Inspection Boat (Assigned)',
    es: 'Lancha para Inspección (Asignada)',
  },
  LEGAL_VISIT_BOAT: { en: 'Statutory Visit Boat', es: 'Lancha para Visita de Ley' },
  INSPECTION_BOAT: { en: 'Inspection Boat', es: 'Lancha para Inspección' },
  MOORING_ASSISTANCE: {
    en: 'Berthing / Unberthing Manoeuvre — Mooring Assistance',
    es: 'Maniobra de Atraque-Desatraque / Asistencia de Amarre',
  },
  GARBAGE_MARPOL: { en: 'Garbage Landing (MARPOL)', es: 'Desembarque de Basura (MARPOL)' },
  SUPPLIES_SPARES: {
    en: 'Supplies / Provisions / Spare Parts (Cargo)',
    es: 'Suministros o Provisiones / Repuestos (Carga)',
  },
};

/**
 * The launch service types that make the authorisation upload mandatory —
 * garbage, crew transfer, and the three authority-assigned boats, per the
 * spec's parenthetical. Everything else may be ordered without a letter.
 */
export const AUTHORIZATION_REQUIRED_LAUNCH_TYPES: readonly LaunchServiceType[] = [
  'CREW_TRANSPORT',
  'ASSIGNED_PILOT_BOAT',
  'ASSIGNED_LEGAL_VISIT_BOAT',
  'ASSIGNED_INSPECTION_BOAT',
  'GARBAGE_MARPOL',
];

// ---------------------------------------------------------------------------
// UNDERWATER_INSPECTION — inspection type
// ---------------------------------------------------------------------------
export const UnderwaterInspectionTypeSchema = z.enum([
  'HULL_CLASS_RENEWAL',
  'PROPELLER_RUDDER',
  'SEA_CHESTS',
  'HULL_CLEANING_PROPELLER_POLISH',
  'ACCIDENTAL_DAMAGE_GROUNDING',
  'ANTINARCOTICS',
]);
export type UnderwaterInspectionType = z.infer<typeof UnderwaterInspectionTypeSchema>;

export const UNDERWATER_INSPECTION_TYPE_LABELS: Record<UnderwaterInspectionType, BilingualLabel> = {
  HULL_CLASS_RENEWAL: {
    en: 'Hull Inspection (Underwater Body) — Class Renewal',
    es: 'Inspección de Casco (Obra Viva) — Renovación de Clase',
  },
  PROPELLER_RUDDER: {
    en: 'Propeller and Rudder Inspection',
    es: 'Inspección de Hélice y Timón',
  },
  SEA_CHESTS: { en: 'Sea Chest Grating Inspection', es: 'Inspección de Rejillas de Succión' },
  HULL_CLEANING_PROPELLER_POLISH: {
    en: 'Hull Cleaning / Propeller Polishing',
    es: 'Limpieza de Casco / Pulido de Hélice',
  },
  ACCIDENTAL_DAMAGE_GROUNDING: {
    en: 'Inspection after Accidental Damage / Grounding',
    es: 'Inspección por Daño Accidental / Varadura',
  },
  ANTINARCOTICS: {
    en: 'Anti-Narcotics Underwater Inspection',
    es: 'Inspección Subacuática por Antinarcóticos',
  },
};

/**
 * Method required. The spec offers only commercial divers today; the enum exists
 * so adding ROV later does not change the column shape.
 */
export const UnderwaterMethodSchema = z.enum(['COMMERCIAL_DIVERS']);
export type UnderwaterMethod = z.infer<typeof UnderwaterMethodSchema>;

export const UNDERWATER_METHOD_LABELS: Record<UnderwaterMethod, BilingualLabel> = {
  COMMERCIAL_DIVERS: { en: 'Commercial Divers', es: 'Buzos Comerciales' },
};

// ---------------------------------------------------------------------------
// BALLAST_WATER — service / analysis type
// ---------------------------------------------------------------------------
export const BallastAnalysisTypeSchema = z.enum([
  'SAMPLING_LAB_D2',
  'VGP_COMPLIANCE',
  'BWMS_EFFICIENCY_TEST',
  'SALINITY_SEDIMENT',
  'VISUAL_TANK_INSPECTION',
]);
export type BallastAnalysisType = z.infer<typeof BallastAnalysisTypeSchema>;

export const BALLAST_ANALYSIS_TYPE_LABELS: Record<BallastAnalysisType, BilingualLabel> = {
  SAMPLING_LAB_D2: {
    en: 'Sampling and Laboratory Analysis (D-2 Standard)',
    es: 'Toma de Muestras y Análisis de Laboratorio (Estándar D-2)',
  },
  VGP_COMPLIANCE: {
    en: 'VGP Compliance Certification (Vessel General Permit)',
    es: 'Certificación de Cumplimiento VGP (Vessel General Permit)',
  },
  BWMS_EFFICIENCY_TEST: {
    en: 'Treatment System Efficiency Test (BWMS)',
    es: 'Prueba de Eficiencia del Sistema de Tratamiento (BWMS)',
  },
  SALINITY_SEDIMENT: {
    en: 'Salinity and Sediment Analysis',
    es: 'Análisis de Salinidad y Sedimentos',
  },
  VISUAL_TANK_INSPECTION: {
    en: 'Visual Ballast Tank Inspection',
    es: 'Inspección Visual de Tanques de Lastre',
  },
};

// ---------------------------------------------------------------------------
// TUG — operation type
// ---------------------------------------------------------------------------
export const TugOperationTypeSchema = z.enum([
  'BERTHING',
  'UNBERTHING',
  'SHIFTING',
  'ESCORTING',
  'EMERGENCY_STANDBY',
  'ENGINE_TRIAL',
]);
export type TugOperationType = z.infer<typeof TugOperationTypeSchema>;

export const TUG_OPERATION_TYPE_LABELS: Record<TugOperationType, BilingualLabel> = {
  BERTHING: { en: 'Berthing (Inbound)', es: 'Atraque (Entrada)' },
  UNBERTHING: { en: 'Unberthing (Outbound)', es: 'Desatraque (Salida)' },
  SHIFTING: { en: 'Shifting Berth', es: 'Cambio de Muelle (Shifting)' },
  ESCORTING: {
    en: 'Escorting in the Navigation Channel',
    es: 'Escolta (Escorting) en Canal de Navegación',
  },
  EMERGENCY_STANDBY: {
    en: 'Emergency Assistance / Stand-by',
    es: 'Asistencia por Emergencia / Stand-by',
  },
  ENGINE_TRIAL: { en: 'Engine Trial', es: 'Prueba de Máquinas (Engine Trial)' },
};

/** The spec caps the tug count at four ("Ej: 1, 2, 3 o 4"). */
export const MAX_TUGS = 4;

// ---------------------------------------------------------------------------
// STS — the role our vessel plays
// ---------------------------------------------------------------------------
export const StsRoleSchema = z.enum(['DISCHARGING', 'RECEIVING']);
export type StsRole = z.infer<typeof StsRoleSchema>;

export const STS_ROLE_LABELS: Record<StsRole, BilingualLabel> = {
  DISCHARGING: { en: 'Discharging Vessel', es: 'Buque Dador' },
  RECEIVING: { en: 'Receiving Vessel', es: 'Buque Receptor' },
};
