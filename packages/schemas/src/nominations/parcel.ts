import { z } from 'zod';

// Strict schema — used for create/update validation
export const NominationParcelSchema = z.object({
  product: z.string().min(1).max(100),
  quantity: z.coerce.number().positive(),
  unit: z.string().min(1).max(20),
  // "LOAD" / "DISCHARGE" — kept as free text per legacy app
  operation: z.string().min(1).max(50),
  // Cargo-update fields — populated via CargoUpdateModal, optional at nomination creation
  etcDate: z.string().optional(),
  etcTime: z.string().optional(),
  qtyOnBoard: z.coerce.number().min(0).optional(),
  qtyOnBoardUnit: z.string().max(20).optional(),
  qtyToGo: z.coerce.number().min(0).optional(),
  qtyToGoUnit: z.string().max(20).optional(),
  loadingRate: z.coerce.number().min(0).optional(),
  loadingRateUnit: z.string().max(20).optional(),
});

// Lenient schema — used when parsing API responses (existing rows may have nulls)
export const NominationParcelReadSchema = z.object({
  product: z.string(),
  quantity: z.coerce.number().nullable().optional(),
  unit: z.string(),
  operation: z.string().nullable().optional(),
  etcDate: z.string().nullable().optional(),
  etcTime: z.string().nullable().optional(),
  qtyOnBoard: z.coerce.number().nullable().optional(),
  qtyOnBoardUnit: z.string().nullable().optional(),
  qtyToGo: z.coerce.number().nullable().optional(),
  qtyToGoUnit: z.string().nullable().optional(),
  loadingRate: z.coerce.number().nullable().optional(),
  loadingRateUnit: z.string().nullable().optional(),
});

export type NominationParcel = z.infer<typeof NominationParcelSchema>;
export type NominationParcelRead = z.infer<typeof NominationParcelReadSchema>;
