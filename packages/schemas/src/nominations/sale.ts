import { z } from 'zod';

// Master-data FKs are cuid ids (same convention as schemas.ts)
const cuidFk = z.string().cuid();

/**
 * HORA FINAL must not precede HORA INICIO. A zero-length service is legitimate
 * (the voucher is sometimes written up after the fact with both times equal),
 * so the check is inclusive. The issue is reported on both fields so whichever
 * one the user is looking at shows the error.
 *
 * Only enforceable when both are present — a PATCH sending endAt alone is
 * re-checked against the stored startAt in NominationsService.updateSale.
 */
function checkServiceWindow(
  data: { startAt?: Date | null; endAt?: Date | null },
  ctx: z.RefinementCtx,
): void {
  if (data.startAt == null || data.endAt == null) return;
  if (data.startAt <= data.endAt) return;

  const message = 'End time must be on or after start time';
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['startAt'] });
  ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['endAt'] });
}

/**
 * Sale — a service sold against a nomination (SALES modal on nomination detail).
 *
 * Field-for-field with the agency's paper service voucher; the two signature
 * lines are deliberately out of scope. price is a plain amount — currency is
 * also deliberately out of scope for now (see .claude/docs/open-questions.md).
 */
export const SaleCreateSchema = z
  .object({
    /** N° DE SERVICIO — transcribed from the paper voucher, not generated here. */
    serviceNo: z.string().max(50).optional().nullable(),
    /** A CUENTA DE — the client the service is billed to. */
    clientId: cuidFk,
    serviceId: cuidFk,
    /** SERVICIO RECORRIDO — the route covered, e.g. "Guaraguao - Muelle 3". */
    route: z.string().max(500).optional().nullable(),
    /** PUERTO */
    portId: cuidFk.optional().nullable(),
    /** COSTO DEL SERVICIO Bs. */
    price: z.coerce.number().nonnegative(),
    /** FECHA + HORA INICIO. UTC-only, per the timestamp Golden Rule. */
    startAt: z.coerce.date(),
    /** HORA FINAL — null while the service is still running. */
    endAt: z.coerce.date().optional().nullable(),
    /** DESCRIPCION */
    description: z.string().max(10_000).optional().nullable(),
    /** CONDUCTOR — FK into the shared SalesContact directory. */
    driverId: cuidFk.optional().nullable(),
    /** USUARIO — FK into the same SalesContact directory; not a Portlog account. */
    userId: cuidFk.optional().nullable(),
  })
  .superRefine(checkServiceWindow);

export const SaleUpdateSchema = SaleCreateSchema.innerType()
  .partial()
  .superRefine(checkServiceWindow);

/**
 * Read schema for API responses: Prisma Decimal serializes to a string
 * ("1500.50") and dates arrive as ISO strings — both coerced here.
 */
export const SaleReadSchema = z.object({
  id: z.string().uuid(),
  nominationId: z.string().uuid(),
  serviceNo: z.string().nullable().optional(),
  clientId: z.string(),
  serviceId: z.string(),
  route: z.string().nullable().optional(),
  portId: z.string().nullable().optional(),
  price: z.coerce.number(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().nullable().optional(),
  description: z.string().nullable().optional(),
  driverId: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  client: z.object({ id: z.string(), name: z.string() }),
  service: z.object({ id: z.string(), name: z.string() }),
  port: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  driver: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  user: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  createdAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
});

export type SaleCreate = z.infer<typeof SaleCreateSchema>;
export type SaleUpdate = z.infer<typeof SaleUpdateSchema>;
export type SaleRead = z.infer<typeof SaleReadSchema>;
