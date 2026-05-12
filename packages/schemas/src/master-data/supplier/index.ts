import { z } from 'zod';
import { ListQuerySchema } from '../../common/pagination';

// Supplier fields match the legacy Proveedores form — Spanish-named fields preserved.
export const SupplierCreateSchema = z.object({
  name: z.string().min(1).max(120),
  contactos: z.string().max(10_000).optional(),
  direccion: z.string().min(1).max(500).optional(),
  servicios: z.string().max(10_000).optional(),
  kyc: z.string().max(10_000).optional(),
  telefonos: z.string().min(1).max(200).optional(),
  correosElectronicos: z.string().max(10_000).optional(),
  certificados: z.string().max(10_000).optional(),
  tarifas: z.string().max(10_000).optional(),
  contratoDeServicios: z.string().max(10_000).optional(),
  acuerdos: z.string().max(10_000).optional(),
  comments: z.string().max(10_000).optional(),
});

export const SupplierUpdateSchema = SupplierCreateSchema.partial();

export const SupplierListQuerySchema = ListQuerySchema;

export type SupplierCreateInput = z.infer<typeof SupplierCreateSchema>;
export type SupplierUpdateInput = z.infer<typeof SupplierUpdateSchema>;
export type SupplierListQuery = z.infer<typeof SupplierListQuerySchema>;
