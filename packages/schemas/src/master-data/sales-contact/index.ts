import { z } from 'zod';
import { optionalText } from '../../common/fields';
import { ListQuerySchema } from '../../common/pagination';

/**
 * SalesContact — the people written on the paper service voucher: CONDUCTOR
 * (the driver) and USUARIO (whoever received the service).
 *
 * One flat directory serves both fields; there is deliberately no driver/user
 * role split, since in practice the same person can appear in either line.
 *
 * Distinct from the `Contact` directory, whose rows hang off a Shipper /
 * Operator / Owner / Charterer cross-link — a driver belongs to no such entity.
 */
export const SalesContactCreateSchema = z.object({
  name: z.string().min(1).max(120),
  phone: optionalText(50),
  mobile: optionalText(50),
  /** Cédula / national ID, as written on the voucher. */
  documentNumber: optionalText(50),
  /** Vehicle or plate the driver operates. */
  vehicle: optionalText(120),
  comments: z.string().max(10_000).optional(),
});

export const SalesContactUpdateSchema = SalesContactCreateSchema.partial();

export const SalesContactListQuerySchema = ListQuerySchema;

export type SalesContactCreateInput = z.infer<typeof SalesContactCreateSchema>;
export type SalesContactUpdateInput = z.infer<typeof SalesContactUpdateSchema>;
export type SalesContactListQuery = z.infer<typeof SalesContactListQuerySchema>;
