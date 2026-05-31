import { z } from 'zod';

// ---------------------------------------------------------------------------
// Port schemas
// ---------------------------------------------------------------------------

export const terminalSchema = z.object({
  terminal_code: z.string(),
  terminal_name: z.string(),
  company_name: z.string(),
  lat: z.number(),
  lon: z.number(),
  url: z.string(),
  address: z.string(),
});

export type Terminal = z.infer<typeof terminalSchema>;

/** Fuzzy port search result (port_find endpoint) */
export const portResultSchema = z.object({
  uuid: z.string(),
  port_name: z.string(),
  country_iso: z.string(),
  country_name: z.string(),
  unlocode: z.string(),
  port_type: z.string(),
  lat: z.number(),
  lon: z.number(),
  area_lvl1: z.string(),
  area_lvl2: z.string(),
});

export type PortResult = z.infer<typeof portResultSchema>;

/** Port detail with terminals (port endpoint) */
export const portDetailSchema = portResultSchema.extend({
  terminals: z.array(terminalSchema),
});

export type PortDetail = z.infer<typeof portDetailSchema>;

// ---------------------------------------------------------------------------
// Vessel schemas
// ---------------------------------------------------------------------------

/** Real-time AIS position (vessel endpoint) */
export const vesselPositionSchema = z.object({
  uuid: z.string(),
  mmsi: z.string(),
  imo: z.string(),
  name: z.string(),
  type: z.string(),
  lat: z.number(),
  lon: z.number(),
  speed: z.number(),
  course: z.number(),
  heading: z.number(),
  navigational_status: z.string(),
  destination: z.string(),
  last_position_epoch: z.number(),
  last_position_UTC: z.string(),
  country_iso: z.string(),
});

export type VesselPosition = z.infer<typeof vesselPositionSchema>;

/** Static vessel specs (vessel_info endpoint) */
export const vesselInfoSchema = z.object({
  uuid: z.string().optional(),
  imo: z.string(),
  name: z.string(),
  name_ais: z.string().nullish(),
  mmsi: z.string(),
  eni: z.string().nullish(),
  country_iso: z.string(),
  country_name: z.string(),
  type: z.string(),
  type_specific: z.string(),
  length: z.number().nullable(),
  breadth: z.number().nullable(),
  draught_avg: z.number().nullable(),
  draught_max: z.number().nullable(),
  gross_tonnage: z.number().nullable(),
  deadweight: z.number().nullable(),
  teu: z.number().nullable(),
  liquid_gas: z.number().nullish(),
  year_built: z.number().nullable(),
  home_port: z.string().nullable(),
  speed_avg: z.number().nullable(),
  speed_max: z.number().nullable(),
  callsign: z.string(),
  is_navaid: z.boolean().nullish(),
});

export type VesselInfo = z.infer<typeof vesselInfoSchema>;

/** Vessel ownership report (ownership endpoint) */
export const vesselOwnershipSchema = z.object({
  imo: z.string(),
  vessel_name: z.string(),
  beneficial_owner: z.string().nullable(),
  beneficial_owner_country: z.string().nullish(),
  operator: z.string().nullable(),
  operator_country: z.string().nullable(),
  technical_manager: z.string().nullable(),
  technical_manager_country: z.string().nullish(),
  commercial_manager: z.string().nullable(),
  commercial_manager_country: z.string().nullish(),
  flag_name: z.string().nullable(),
  vessel_type_code: z.string().nullable(),
  built_year: z.string().nullable(),
  dwt_design: z.number().nullable(),
  buyer: z.string().nullish(),
  class1_code: z.string().nullish(),
  pi_club: z.string().nullish(),
  modified_at: z.string().nullish(),
});

export type VesselOwnership = z.infer<typeof vesselOwnershipSchema>;

/** Vessel from vessel_inradius endpoint */
export const radiusVesselSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  mmsi: z.string(),
  imo: z.string(),
  country_iso: z.string(),
  type: z.string(),
  type_specific: z.string(),
  lat: z.number(),
  lon: z.number(),
  speed: z.number(),
  course: z.number(),
  heading: z.number(),
  navigation_status: z.string().nullish(),
  destination: z.string(),
  last_position_epoch: z.number(),
  last_position_UTC: z.string(),
  eta_epoch: z.number().nullable(),
  eta_UTC: z.string().nullable(),
  distance: z.number(),
});

export type RadiusVessel = z.infer<typeof radiusVesselSchema>;

/** Normalized vessel_pro data */
export const vesselProDataSchema = z.object({
  imo: z.string(),
  name: z.string().optional(),
  eta_UTC: z.string().nullable(),
  eta_epoch: z.number().nullable(),
  dest_port: z.string().nullable(),
  dest_port_unlocode: z.string().nullable(),
  dep_port: z.string().nullable(),
  dep_port_unlocode: z.string().nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  speed: z.number().nullable(),
  course: z.number().nullable(),
  heading: z.number().nullable(),
  navigation_status: z.string().nullable(),
  destination: z.string().nullable(),
  last_position_epoch: z.number().nullable(),
  last_position_UTC: z.string().nullable(),
  type: z.string().nullable(),
  type_specific: z.string().nullable(),
  country_iso: z.string().nullable(),
  mmsi: z.string().nullable(),
});

export type VesselProData = z.infer<typeof vesselProDataSchema>;

/** Single position in a vessel's AIS history (vessel_history endpoint) */
export const historyPositionSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  speed: z.number(),
  course: z.number(),
  heading: z.number(),
  navigation_status: z.string().nullish(),
  destination: z.string().nullish(),
  last_position_epoch: z.number(),
  last_position_UTC: z.string(),
});

export type HistoryPosition = z.infer<typeof historyPositionSchema>;

/** Full vessel history response (vessel_history endpoint) */
export const vesselHistorySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  mmsi: z.string(),
  imo: z.string(),
  positions: z.array(historyPositionSchema),
});

export type VesselHistory = z.infer<typeof vesselHistorySchema>;

/** Port state control inspection record (inspections endpoint) */
export const vesselInspectionSchema = z.object({
  id: z.number(),
  imo: z.string(),
  vessel_name: z.string(),
  vessel_type_code: z.string().nullable(),
  flag_code: z.string().nullable(),
  inspection_date: z.string(),
  inspection_authority: z.string().nullable(),
  inspection_port: z.string().nullable(),
  inspection_type: z.string().nullable(),
  detention: z.string().nullable(),
  ship_deficiencies: z.string().nullable(),
  deficiency_description: z.string().nullable(),
  technical_ism_manager: z.string().nullable(),
  company_imo: z.string().nullable(),
  modified_at: z.string().nullable(),
});

export type VesselInspection = z.infer<typeof vesselInspectionSchema>;

/** Dry dock and survey certification dates (dry_dock_dates endpoint) */
export const vesselDryDockSchema = z.object({
  id: z.number().optional(),
  imo: z.string(),
  vessel_name: z.string(),
  special_survey_date: z.string().nullable(),
  dry_dock_date: z.string().nullable(),
  iopp_issue_date: z.string().nullable(),
  iopp_exp_date: z.string().nullable(),
  country_name: z.string().nullable(),
  technical_manager: z.string().nullable(),
  country_code: z.string().nullable(),
  website: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  linkedin: z.string().nullish(),
  modified_at: z.string().nullable(),
});

export type VesselDryDock = z.infer<typeof vesselDryDockSchema>;

/** Main engine specifications (engine endpoint) */
export const vesselEngineSchema = z.object({
  imo: z.string(),
  vessel_name: z.string(),
  vessel_type_code: z.string().nullable(),
  propulsion_type_code: z.string().nullable(),
  mco: z.number().nullable(),
  mco_unit: z.string().nullable(),
  mco_rpm: z.number().nullable(),
  trading_category_code: z.string().nullable(),
  built_year: z.string().nullable(),
  gt: z.number().nullable(),
  engine_designation: z.string().nullable(),
  engine_builder: z.string().nullable(),
  engine_designer: z.string().nullable(),
  modified_at: z.string().nullable(),
});

export type VesselEngine = z.infer<typeof vesselEngineSchema>;

/** Fleet entry for localStorage management */
export const fleetEntrySchema = z.object({
  imo: z.string(),
  addedAt: z.number(),
  name: z.string().optional(),
  departureSince: z.number().optional(),
});

export type FleetEntry = z.infer<typeof fleetEntrySchema>;

/** Vessel in-radius API response wrapper */
export const vesselInRadiusResponseSchema = z.object({
  point: z.object({ lat: z.number(), lon: z.number(), radius: z.number() }),
  total: z.number(),
  vessels: z.array(radiusVesselSchema),
});

export type VesselInRadiusResponse = z.infer<typeof vesselInRadiusResponseSchema>;
