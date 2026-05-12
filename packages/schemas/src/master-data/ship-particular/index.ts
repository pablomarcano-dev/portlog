import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// imoNumber: 7-digit string, nullable for vessels not yet assigned an IMO.
// callSign: uppercase alphanumeric, 3–15 characters, nullable for new builds.
// flagId: required — every vessel must reference a Flag record.
// Decimal fields (loa, dwt, grt, nrt): nonnegative numbers.
export const ShipParticularCreateSchema = z.object({
  name: z.string().min(1).max(120),
  abbreviation: z.string().min(1).max(20).optional(),
  callSign: z
    .string()
    .regex(/^[A-Z0-9]+$/, 'Call sign must be uppercase alphanumeric')
    .min(3)
    .max(15)
    .optional(),
  imoNumber: z
    .string()
    .regex(/^\d{7}$/, 'IMO number must be exactly 7 digits')
    .optional(),
  email: z.string().email().toLowerCase().optional(),
  phone: z.string().min(1).max(50).optional(),
  phone2: z.string().min(1).max(50).optional(),
  fax: z.string().min(1).max(50).optional(),
  flagId: z.string().cuid(),
  ownerId: z.string().cuid().optional(),
  operatorId: z.string().cuid().optional(),
  loa: z.number().nonnegative().optional(),
  dwt: z.number().nonnegative().optional(),
  grt: z.number().nonnegative().optional(),
  nrt: z.number().nonnegative().optional(),
  comments: z.string().max(10_000).optional(),
});

export const ShipParticularUpdateSchema = ShipParticularCreateSchema.partial();

export const ShipParticularListQuerySchema = ListQuerySchema;

export type ShipParticularCreateInput = z.infer<typeof ShipParticularCreateSchema>;
export type ShipParticularUpdateInput = z.infer<typeof ShipParticularUpdateSchema>;
export type ShipParticularListQuery = z.infer<typeof ShipParticularListQuerySchema>;
