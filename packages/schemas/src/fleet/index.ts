import { z } from 'zod';

export const addFleetVesselsSchema = z.object({
  imos: z.array(z.string().regex(/^\d{7}$/, 'Each IMO must be 7 digits')).min(1),
  unlocode: z.string().min(1),
});

export type AddFleetVesselsInput = z.infer<typeof addFleetVesselsSchema>;

export const updateFleetVesselSchema = z.object({
  unlocode: z.string().min(1),
  departureSince: z.number().nullable(),
});

export type UpdateFleetVesselInput = z.infer<typeof updateFleetVesselSchema>;

export const fleetQuerySchema = z.object({
  unlocode: z.string().min(1),
});

export type FleetQuery = z.infer<typeof fleetQuerySchema>;
