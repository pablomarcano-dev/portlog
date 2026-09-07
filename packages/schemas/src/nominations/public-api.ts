import { z } from 'zod';
import { NominationKindSchema, NominationStatusSchema, NominationTypeSchema } from './enums.js';

const nullablePortSchema = z
  .object({
    name: z.string(),
    abbreviation: z.string().nullable(),
  })
  .nullable();

const publicVoyageSchema = z.object({
  number: z.string(),
  code: z.string().nullable(),
});

const publicVesselListSchema = z.object({
  name: z.string(),
  callSign: z.string(),
  imoNumber: z.string().nullable(),
});

export const PublicNominationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
  status: NominationStatusSchema.optional(),
  sort: z
    .enum([
      'nominatedAt',
      '-nominatedAt',
      'eta',
      '-eta',
      'createdAt',
      '-createdAt',
      'updatedAt',
      '-updatedAt',
    ])
    .default('-updatedAt'),
});

export const PublicNominationListItemSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  kind: NominationKindSchema,
  status: NominationStatusSchema,
  nominationType: NominationTypeSchema,
  voyage: publicVoyageSchema,
  vessel: publicVesselListSchema,
  operatingPort: nullablePortSchema,
  nominatedAt: z.string().datetime(),
  eta: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PublicNominationListResponseSchema = z.object({
  data: z.array(PublicNominationListItemSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalItems: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  }),
});

export const PublicNominationSchema = z.object({
  id: z.string().uuid(),
  reference: z.string(),
  kind: NominationKindSchema,
  status: NominationStatusSchema,
  nominationType: NominationTypeSchema,
  voyage: publicVoyageSchema,
  vessel: publicVesselListSchema.extend({
    flag: z.string().nullable(),
    loa: z.number().nullable(),
    grt: z.number().nullable(),
    nrt: z.number().nullable(),
  }),
  client: z.object({ name: z.string() }).nullable(),
  ports: z.object({
    operating: nullablePortSchema,
    pier: z.object({ name: z.string() }).nullable(),
    last: nullablePortSchema,
    next: nullablePortSchema,
    discharge: nullablePortSchema,
  }),
  dates: z.object({
    nominatedAt: z.string().datetime(),
    nominationRepliedAt: z.string().datetime().nullable(),
    laycanFrom: z.string().datetime().nullable(),
    laycanTo: z.string().datetime().nullable(),
    eta: z.string().datetime().nullable(),
  }),
  contacts: z.object({
    master: z.string().nullable(),
    broker: z.string().nullable(),
    boardingClerk: z.string().nullable(),
    inspector: z.string().nullable(),
  }),
  subject: z.string().nullable(),
  referenceNumber: z.string().nullable(),
  cargo: z.array(
    z.object({
      product: z.string(),
      quantity: z.number().nullable(),
      unit: z.string(),
      operation: z.string().nullable(),
      // Port-local civil time. The source data does not contain a timezone.
      estimatedCompletionAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00$/)
        .nullable(),
      quantityOnBoard: z.number().nullable(),
      quantityToGo: z.number().nullable(),
      loadingRate: z.number().nullable(),
      loadingRateUnit: z.string().nullable(),
    }),
  ),
  parties: z.array(
    z.object({
      type: z.string(),
      name: z.string(),
      voyageReference: z.string().nullable(),
      referenceNumber: z.string().nullable(),
      proforma: z.string().nullable(),
      broker: z.string().nullable(),
    }),
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PublicNominationResponseSchema = z.object({ data: PublicNominationSchema });

export const PublicApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});

export type PublicNominationListQuery = z.infer<typeof PublicNominationListQuerySchema>;
export type PublicNominationListResponse = z.infer<typeof PublicNominationListResponseSchema>;
export type PublicNominationResponse = z.infer<typeof PublicNominationResponseSchema>;
