import { z } from 'zod';
import { NominationStatusSchema, NominationTypeSchema } from './enums.js';
import { NominationFeatureSchema, NominationFeatureReadSchema } from './feature.js';
import { BranchSummarySchema } from '../master-data/branch/index.js';
import { NominationClientSchema, NominationClientCreateSchema } from './client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** cuid()-keyed foreign key pointing at an M2 master-data entity */
const cuidFk = z.string().cuid();

// ---------------------------------------------------------------------------
// NominationCreateSchema
// Required: shipParticularId, voyageNumber, dateNominated, nominationType
// All other fields optional. Status is implicitly DRAFT (server-assigned).
// correlative is server-assigned — never accepted on input.
// ---------------------------------------------------------------------------
export const NominationCreateSchema = z
  .object({
    // Vessel — required
    shipParticularId: cuidFk,

    // Voyage — voyageNumber is auto-assigned from correlative if omitted
    voyageNumber: z.string().max(20).optional(),

    // Parties — all optional cuid FKs into M2 entities
    operatorId: cuidFk.optional(),
    operatorVariant: z.string().max(255).optional(),
    operatorContactId: cuidFk.optional(),

    charterId: cuidFk.optional(),
    charterVariant: z.string().max(255).optional(),
    charterContactId: cuidFk.optional(),

    ownerId: cuidFk.optional(),
    ownerVariant: z.string().max(255).optional(),
    ownerContactId: cuidFk.optional(),

    shipperId: cuidFk.optional(),
    shipperVariant: z.string().max(255).optional(),
    shipperContactId: cuidFk.optional(),

    agentId: cuidFk.optional(),

    // Branch — resolves Open Question #5
    branchId: cuidFk.optional(),

    // Supplementary fields from legacy General Info tab
    nomReply: z.coerce.date().optional(),
    externalPortId: cuidFk.optional(),
    mobileOnBoard: z.string().max(50).optional(),
    referenceNo: z.string().max(100).optional(),

    contactBlackBerry: z.string().max(255).optional().nullable(),
    blindCopy: z.string().max(255).optional().nullable(),

    // Email recipients — saved at creation and used by all email sends in this nomination flow
    emailTo: z.array(z.string().email()).default([]),
    emailCc: z.array(z.string().email()).default([]),
    emailBcc: z.array(z.string().email()).default([]),

    // Ports — all optional cuid FKs; pierId references Pier (child of opPort)
    opPortId: cuidFk.optional(),
    pierId: cuidFk.optional(),
    lastPortId: cuidFk.optional(),
    nextPortId: cuidFk.optional(),
    disPortId: cuidFk.optional(),

    // Dates — ISO 8601 strings coerced to Date; UTC required
    dateNominated: z.coerce.date(),
    layDaysFirst: z.coerce.date().nullable().optional(),
    layDaysLast: z.coerce.date().nullable().optional(),
    etaDate: z.coerce.date().nullable().optional(),

    // People — nominatedById is a cuid FK; others are free-text
    nominatedById: cuidFk.optional(),
    master: z.string().max(255).optional(),
    mic: z.string().max(255).optional(),
    broker: z.string().max(255).optional(),
    boardingClerk: z.string().max(255).optional(),
    inspector: z.string().max(255).optional(),

    // Type + subject
    nominationType: NominationTypeSchema.default('FULL_AGENCY'),
    subject: z.string().max(500).optional(),

    // Features (JSON array of Product/Qtty/Unit/Oper rows)
    features: z.array(NominationFeatureSchema).default([]),

    // Client list rows — created atomically with the nomination
    nominationClients: z.array(NominationClientCreateSchema).default([]),
  })
  .superRefine((data, ctx) => {
    if (
      data.layDaysFirst != null &&
      data.layDaysLast != null &&
      data.layDaysFirst > data.layDaysLast
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'layDaysFirst must be on or before layDaysLast',
        path: ['layDaysFirst'],
      });
    }
  });

// ---------------------------------------------------------------------------
// NominationUpdateSchema
// Partial of create, excluding status (status transitions via separate endpoint)
// ---------------------------------------------------------------------------
export const NominationUpdateSchema = NominationCreateSchema.innerType()
  .partial()
  .superRefine((data, ctx) => {
    if (
      data.layDaysFirst != null &&
      data.layDaysLast != null &&
      data.layDaysFirst > data.layDaysLast
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'layDaysFirst must be on or before layDaysLast',
        path: ['layDaysFirst'],
      });
    }
  });

// ---------------------------------------------------------------------------
// NominationStatusTransitionSchema
// reason is required when toStatus === 'CANCELLED'
// ---------------------------------------------------------------------------
export const NominationStatusTransitionSchema = z
  .object({
    toStatus: NominationStatusSchema,
    reason: z.string().min(1).max(500).optional(),
  })
  .refine((v) => v.toStatus !== 'CANCELLED' || (v.reason != null && v.reason.length > 0), {
    message: 'reason is required when cancelling a nomination',
    path: ['reason'],
  });

// ---------------------------------------------------------------------------
// NominationListQuerySchema
// page defaults to 1, pageSize default 25 max 100
// search matches voyageNumber, shipParticulars.name, or correlative
// dateFrom/dateTo filter on dateNominated
// ---------------------------------------------------------------------------
export const NominationListQuerySchema = z.object({
  status: NominationStatusSchema.optional(),
  portId: cuidFk.optional(),
  shipParticularId: cuidFk.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});

// ---------------------------------------------------------------------------
// NominationListItemSchema — slim shape for GET /api/nominations list screen
// ---------------------------------------------------------------------------
export const NominationListItemSchema = z.object({
  id: z.string().uuid(),
  correlative: z.number().int().positive(),
  voyageNumber: z.string(),
  voyageCode: z.string().nullable(),
  status: NominationStatusSchema,
  nominationType: NominationTypeSchema,
  dateNominated: z.coerce.date(),
  shipParticular: z.object({
    id: cuidFk,
    name: z.string(),
    callSign: z.string(),
  }),
  opPort: z
    .object({
      id: cuidFk,
      name: z.string(),
      abbreviation: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// NominationStatusHistoryItemSchema — single row in the status audit trail
// ---------------------------------------------------------------------------
export const NominationStatusHistoryItemSchema = z.object({
  id: z.string().uuid(),
  nominationId: z.string().uuid(),
  fromStatus: NominationStatusSchema.nullable(),
  toStatus: NominationStatusSchema,
  reason: z.string().nullable(),
  changedBy: z.object({
    id: cuidFk,
    email: z.string().email(),
  }),
  createdAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// NominationSchema — full read shape for GET /api/nominations/:id
// ---------------------------------------------------------------------------
const PortSummarySchema = z
  .object({
    id: cuidFk,
    name: z.string(),
    abbreviation: z.string().nullable(),
  })
  .nullable();

const PartySummarySchema = z
  .object({
    id: cuidFk,
    name: z.string(),
  })
  .nullable();

const UserSummarySchema = z
  .object({
    id: cuidFk,
    email: z.string().email(),
  })
  .nullable();

export const NominationSchema = z.object({
  id: z.string().uuid(),
  correlative: z.number().int().positive(),

  // Voyage
  voyageNumber: z.string(),
  voyageCode: z.string().nullable(),

  // Vessel
  shipParticularId: cuidFk,
  shipParticular: z.object({
    id: cuidFk,
    name: z.string(),
    callSign: z.string(),
    imoNumber: z.string().nullable(),
    abbreviation: z.string().nullable(),
  }),

  // Parties
  operatorId: cuidFk.nullable(),
  operator: PartySummarySchema,
  operatorVariant: z.string().nullable(),
  operatorContactId: cuidFk.nullable(),

  charterId: cuidFk.nullable(),
  charter: PartySummarySchema,
  charterVariant: z.string().nullable(),
  charterContactId: cuidFk.nullable(),

  ownerId: cuidFk.nullable(),
  owner: PartySummarySchema,
  ownerVariant: z.string().nullable(),
  ownerContactId: cuidFk.nullable(),

  shipperId: cuidFk.nullable(),
  shipper: PartySummarySchema,
  shipperVariant: z.string().nullable(),
  shipperContactId: cuidFk.nullable(),

  agentId: cuidFk.nullable(),
  agent: PartySummarySchema,

  // Branch — resolves Open Question #5
  branchId: z.string().nullable(),
  branch: BranchSummarySchema.nullable(),

  // Supplementary fields from legacy General Info tab
  nomReply: z.coerce.date().nullable(),
  externalPortId: z.string().nullable(),
  externalPort: z
    .object({
      id: cuidFk,
      name: z.string(),
      abbreviation: z.string().nullable(),
    })
    .nullable(),
  mobileOnBoard: z.string().nullable(),
  referenceNo: z.string().nullable(),

  contactBlackBerry: z.string().nullable(),
  blindCopy: z.string().nullable(),

  // Email recipients — used by all email sends in this nomination flow
  emailTo: z.array(z.string()).default([]),
  emailCc: z.array(z.string()).default([]),
  emailBcc: z.array(z.string()).default([]),

  // Ports
  opPortId: cuidFk.nullable(),
  opPort: PortSummarySchema,
  pierId: cuidFk.nullable(),
  pier: z.object({ id: z.string(), name: z.string() }).nullable(),
  lastPortId: cuidFk.nullable(),
  lastPort: PortSummarySchema,
  nextPortId: cuidFk.nullable(),
  nextPort: PortSummarySchema,
  disPortId: cuidFk.nullable(),
  disPort: PortSummarySchema,

  // Dates
  dateNominated: z.coerce.date(),
  layDaysFirst: z.coerce.date().nullable(),
  layDaysLast: z.coerce.date().nullable(),
  etaDate: z.coerce.date().nullable(),

  // People
  nominatedById: cuidFk.nullable(),
  nominatedBy: UserSummarySchema,
  master: z.string().nullable(),
  mic: z.string().nullable(),
  broker: z.string().nullable(),
  boardingClerk: z.string().nullable(),
  inspector: z.string().nullable(),

  // Type + subject
  nominationType: NominationTypeSchema,
  subject: z.string().nullable(),

  // Features — lenient read schema; strict validation only on create/update
  features: z.array(NominationFeatureReadSchema),

  // Client list rows
  nominationClients: z.array(NominationClientSchema).default([]),

  // State machine
  status: NominationStatusSchema,
  statusHistory: z.array(NominationStatusHistoryItemSchema),

  // Audit
  createdById: cuidFk,
  createdBy: z.object({
    id: cuidFk,
    email: z.string().email(),
  }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// NominationListResponseSchema — paginated list response from GET /api/nominations
// ---------------------------------------------------------------------------
export const NominationListResponseSchema = z.object({
  items: z.array(NominationListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});

// ---------------------------------------------------------------------------
// Inferred TypeScript types
// ---------------------------------------------------------------------------
export type NominationListResponse = z.infer<typeof NominationListResponseSchema>;
export type NominationCreateInput = z.infer<typeof NominationCreateSchema>;
export type NominationUpdateInput = z.infer<typeof NominationUpdateSchema>;
export type NominationStatusTransition = z.infer<typeof NominationStatusTransitionSchema>;
export type NominationListQuery = z.infer<typeof NominationListQuerySchema>;
export type NominationListItem = z.infer<typeof NominationListItemSchema>;
export type NominationStatusHistoryItem = z.infer<typeof NominationStatusHistoryItemSchema>;
export type Nomination = z.infer<typeof NominationSchema>;
