import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// Owner has many Spanish-named fields matching the legacy form spec.
// historyJson: JSON blob for Buques / OTs / Factura / PagosRecibidos — full
//   relational normalization deferred to a future milestone.
// acuerdos: financial field, access gated by "owner.financial" permission (M2-S12).
export const OwnerCreateSchema = z.object({
  nombre: z.string().min(1).max(120),
  listadoContacto: z.string().min(1).max(120).optional(),
  cantidad: z.number().int().nonnegative().optional(),
  numeroContacto: z.string().min(1).max(50).optional(),
  direccionFisica: z.string().min(1).max(500).optional(),
  telefonos: z.string().min(1).max(200).optional(),
  direccion: z.string().min(1).max(500).optional(),
  cargo: z.string().min(1).max(120).optional(),
  redesSociales: z.string().min(1).max(500).optional(),
  comentarios: z.string().max(10_000).optional(),
  cumpleanos: z.string().min(1).max(50).optional(),
  gustos: z.string().max(10_000).optional(),
  recomendaciones: z.string().max(10_000).optional(),
  business: z.string().max(10_000).optional(),
  webpage: z.string().url().optional(),
  acuerdos: z.string().max(10_000).optional(),
  historyJson: z.record(z.unknown()).optional(),
  comments: z.string().max(10_000).optional(),
});

export const OwnerUpdateSchema = OwnerCreateSchema.partial();

export const OwnerListQuerySchema = ListQuerySchema;

export type OwnerCreateInput = z.infer<typeof OwnerCreateSchema>;
export type OwnerUpdateInput = z.infer<typeof OwnerUpdateSchema>;
export type OwnerListQuery = z.infer<typeof OwnerListQuerySchema>;
