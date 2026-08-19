import { z } from 'zod';
import { attachmentIdsSchema } from '../attachments/index.js';
import { ServiceRequestDetailsSchema, requiresAuthorizationDocument } from './details.js';
import {
  clearableRef,
  optionalDate,
  optionalNumber,
  optionalTextField,
  requiredDate,
  requiredNumber,
  requiredRef,
} from './fields.js';
import {
  choice,
  ServiceLocationSchema,
  ServiceRequestStatusSchema,
  ServiceRequestTypeSchema,
} from './enums.js';

// ---------------------------------------------------------------------------
// Shared field builders
// ---------------------------------------------------------------------------
// Every field carries an explicit message. Zod's defaults ("Required",
// "Invalid cuid", "Expected number, received nan") are rendered verbatim under
// the input by `zodResolver`, and an operator filling a service request needs
// to be told what to do, not what type-check failed.
// ---------------------------------------------------------------------------

const emailList = (field: string) =>
  z.array(z.string().email(`${field} contains an address that is not valid`));

// ---------------------------------------------------------------------------
// Create / update
// ---------------------------------------------------------------------------
// Draft saves are deliberately lenient — an operator starts the request the
// moment the vessel calls, long before the authority letter or the provider's
// quote exist. The strict, cross-field checks live on
// ServiceRequestSendReadinessSchema and are re-run in
// ServiceRequestsService.sendOrder().
// ---------------------------------------------------------------------------

export const ServiceRequestCreateSchema = z.object({
  type: choice(ServiceRequestTypeSchema, 'Select a service request type'),

  /** The anchor. Required: a request always concerns a vessel. */
  shipParticularId: requiredRef('vessel'),
  /** Pre-filled from the signed-in user's branch, still editable. */
  branchId: requiredRef('branch'),
  /**
   * Optional soft link to a port call. The module is horizontal by design: a
   * request is valid with no nomination at all, and deleting the nomination
   * must not delete the request (SetNull at the DB level).
   */
  nominationId: z.string().uuid('Select an SN/OT nomination from your branch'),

  /** The provider. Required before sending, optional while drafting. */
  supplierId: clearableRef('provider'),

  location: choice(ServiceLocationSchema, 'Select where the vessel is').nullish(),
  portId: clearableRef('port'),
  /** The berth, for the tug form's terminal picker. */
  pierId: clearableRef('berth'),

  /**
   * The one scheduled datetime. Named "Hora de Zarpe" on the launch form,
   * "Fecha y Hora Estimada de Inicio" on the diving form, "Fecha y Hora
   * Programada" on the ballast form and "Hora de Maniobra (Pilot on Board)" on
   * the tug form — the same field each time. UTC-only, per Golden Rule 6.
   */
  scheduledAt: requiredDate('Enter the scheduled date and time'),
  completedAt: optionalDate('Enter a valid completion date and time'),

  /**
   * The number on the slip the provider hands over, written down afterwards for
   * accounting reconciliation.
   */
  physicalVoucherNo: optionalTextField(50, 'Voucher number'),

  /** Free-text instructions to the provider. */
  notes: optionalTextField(10_000, 'Observations'),

  /** Per-type payload — see details.ts. */
  details: ServiceRequestDetailsSchema,

  // Commercial fields. Absent from all five specs (they describe procurement,
  // not billing) but carried forward from the deprecated `Sale` so the module
  // still answers "what did we sell against this vessel" and can feed the
  // future PDA/FDA module. All optional.
  billToClientId: clearableRef('client'),
  estimatedCost: optionalNumber({
    notANumber: 'Estimated cost must be a number',
    negative: 'Estimated cost cannot be negative',
  }),
  actualCost: optionalNumber({
    notANumber: 'Actual cost must be a number',
    negative: 'Actual cost cannot be negative',
  }),
  /** ISO-4217. The paper voucher says "Bs." — Venezuelan bolívar. */
  currency: z
    .string({ invalid_type_error: 'Currency must be text' })
    .trim()
    .length(3, 'Currency must be a 3-letter code, e.g. VES or USD')
    .toUpperCase()
    .default('VES'),
});
export type ServiceRequestCreate = z.infer<typeof ServiceRequestCreateSchema>;

/**
 * PATCH body. `type` is immutable after creation — switching type would orphan
 * the whole `details` payload, so the caller deletes and re-creates instead.
 */
export const ServiceRequestUpdateSchema = ServiceRequestCreateSchema.omit({ type: true }).partial();
export type ServiceRequestUpdate = z.infer<typeof ServiceRequestUpdateSchema>;

// ---------------------------------------------------------------------------
// Send — generate the purchase order and email it
// ---------------------------------------------------------------------------

export const ServiceRequestSendSchema = z.object({
  /**
   * Defaults server-side to the selected provider's addresses. The spec asks
   * for those to be *shown* before sending, so the client sends back whatever
   * the operator confirmed.
   */
  toAddresses: emailList('Recipients').min(1, 'Add at least one recipient'),
  ccAddresses: emailList('CC').default([]),
  bccAddresses: emailList('BCC').default([]),
  subject: optionalTextField(500, 'Subject'),
  /** Plain text as authored; wrapped for mail clients at send time. */
  bodyText: optionalTextField(20_000, 'Message'),
  /** Extra files beyond the generated order and the request's own documents. */
  attachmentIds: attachmentIdsSchema,
});
export type ServiceRequestSend = z.infer<typeof ServiceRequestSendSchema>;

/**
 * The gate the send action must pass. Validated on the client so the Review
 * step can explain what is missing, and re-validated in the service layer
 * because Golden Rule 5 puts authorization in the backend.
 *
 * `documentCount` is the number of authorisation documents already uploaded
 * against the request.
 */
export const ServiceRequestSendReadinessSchema = z
  .object({
    supplierId: z.string().nullish(),
    details: ServiceRequestDetailsSchema,
    documentCount: z
      .number({ invalid_type_error: 'Document count must be a number' })
      .int()
      .nonnegative(),
  })
  .superRefine((data, ctx) => {
    if (data.supplierId == null || data.supplierId === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select a provider before generating the order',
        path: ['supplierId'],
      });
    }
    if (requiresAuthorizationDocument(data.details) && data.documentCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'This service type requires an authority authorisation letter to be uploaded',
        path: ['documentCount'],
      });
    }
  });
export type ServiceRequestSendReadiness = z.infer<typeof ServiceRequestSendReadinessSchema>;

// ---------------------------------------------------------------------------
// Status transitions
// ---------------------------------------------------------------------------

export const ServiceRequestTransitionSchema = z.object({
  status: z.enum(['COMPLETED', 'CANCELLED'], {
    errorMap: () => ({ message: 'A request may only be marked completed or cancelled' }),
  }),
  reason: optionalTextField(500, 'Reason'),
});
export type ServiceRequestTransition = z.infer<typeof ServiceRequestTransitionSchema>;

// ---------------------------------------------------------------------------
// List query
// ---------------------------------------------------------------------------

export const ServiceRequestListQuerySchema = z.object({
  type: choice(ServiceRequestTypeSchema, 'Unknown service request type filter').optional(),
  status: choice(ServiceRequestStatusSchema, 'Unknown status filter').optional(),
  shipParticularId: z.string().cuid('That vessel reference is not valid').optional(),
  branchId: z.string().cuid('That branch reference is not valid').optional(),
  supplierId: z.string().cuid('That provider reference is not valid').optional(),
  nominationId: z.string().uuid('That nomination reference is not valid').optional(),
  dateFrom: z.coerce.date({ invalid_type_error: '"From" must be a valid date' }).optional(),
  dateTo: z.coerce.date({ invalid_type_error: '"To" must be a valid date' }).optional(),
  // These two keep `z.coerce` deliberately: they only ever arrive as URL search
  // params, never from an input the user can leave blank.
  /** Matches control number, vessel name, voucher number or provider name. */
  search: z.string().max(100, 'Search text must be 100 characters or fewer').optional(),
  page: requiredNumber({ missing: 'Page is required', notANumber: 'Page must be a number' })
    .pipe(z.number().int('Page must be a whole number').positive('Page must be 1 or greater'))
    .default(1),
  pageSize: requiredNumber({
    missing: 'Page size is required',
    notANumber: 'Page size must be a number',
  })
    .pipe(
      z
        .number()
        .int('Page size must be a whole number')
        .positive('Page size must be 1 or greater')
        .max(100, 'Page size cannot exceed 100'),
    )
    .default(25),
});
export type ServiceRequestListQuery = z.infer<typeof ServiceRequestListQuerySchema>;

/**
 * URL search-param shape for the list route. Dates stay `YYYY-MM-DD` strings
 * rather than being coerced to Date — TanStack Router's replaceEqualDeep only
 * preserves referential identity for plain objects and arrays, so a Date in
 * search params is a new instance every parse and the route render-loops.
 * Same reasoning as NominationListSearchSchema; see the note there.
 */
export const ServiceRequestListSearchSchema = ServiceRequestListQuerySchema.extend({
  dateFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '"From" must be a date in YYYY-MM-DD form')
    .optional(),
  dateTo: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '"To" must be a date in YYYY-MM-DD form')
    .optional(),
});
export type ServiceRequestListSearch = z.infer<typeof ServiceRequestListSearchSchema>;

// ---------------------------------------------------------------------------
// Read shapes
// ---------------------------------------------------------------------------
// These parse trusted API responses rather than user input, so they carry no
// per-field messages — a failure here is a backend contract break, not
// something an operator can fix, and it should read as a loud developer error.
// ---------------------------------------------------------------------------

const NamedRefSchema = z.object({ id: z.string(), name: z.string() });

export const ServiceRequestDocumentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
});
export type ServiceRequestDocument = z.infer<typeof ServiceRequestDocumentSchema>;

export const ServiceRequestListItemSchema = z.object({
  id: z.string().uuid(),
  correlative: z.number().int().positive(),
  /** Rendered `SN1234/26/PLC`, attached by the service layer. */
  controlNumber: z.string(),
  type: ServiceRequestTypeSchema,
  status: ServiceRequestStatusSchema,
  vesselName: z.string(),
  branchCode: z.string(),
  supplierName: z.string().nullable(),
  /** Human label for the type-specific service, resolved from `details`. */
  serviceLabel: z.string(),
  location: ServiceLocationSchema.nullable(),
  scheduledAt: z.coerce.date(),
  physicalVoucherNo: z.string().nullable(),
  actualCost: z.coerce.number().nullable(),
  currency: z.string(),
  sentAt: z.coerce.date().nullable(),
  requestedBy: z.string(),
});
export type ServiceRequestListItem = z.infer<typeof ServiceRequestListItemSchema>;

export const ServiceRequestListResponseSchema = z.object({
  items: z.array(ServiceRequestListItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
});
export type ServiceRequestListResponse = z.infer<typeof ServiceRequestListResponseSchema>;

export const ServiceRequestNominationOptionSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  reference: z.string(),
  shipParticularId: z.string(),
  vesselName: z.string(),
  branchId: z.string(),
  branchName: z.string(),
});
export type ServiceRequestNominationOption = z.infer<typeof ServiceRequestNominationOptionSchema>;

export const ServiceRequestReadSchema = z.object({
  id: z.string().uuid(),
  correlative: z.number().int().positive(),
  controlNumber: z.string(),
  type: ServiceRequestTypeSchema,
  status: ServiceRequestStatusSchema,

  shipParticularId: z.string(),
  shipParticular: NamedRefSchema.extend({ imoNumber: z.string().nullable() }),
  branchId: z.string(),
  branch: NamedRefSchema.extend({ code: z.string() }),
  nominationId: z.string().nullable(),
  supplierId: z.string().nullable(),
  supplier: NamedRefSchema.extend({ emails: z.array(z.string()) }).nullable(),
  providerEmails: z.array(z.string()),

  location: ServiceLocationSchema.nullable(),
  portId: z.string().nullable(),
  port: NamedRefSchema.nullable(),
  pierId: z.string().nullable(),
  pier: NamedRefSchema.nullable(),

  scheduledAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
  physicalVoucherNo: z.string().nullable(),
  notes: z.string().nullable(),
  details: ServiceRequestDetailsSchema,

  billToClientId: z.string().nullable(),
  billToClient: NamedRefSchema.nullable(),
  estimatedCost: z.coerce.number().nullable(),
  actualCost: z.coerce.number().nullable(),
  currency: z.string(),

  /** True when the type/service combination makes the authorisation upload mandatory. */
  authorizationRequired: z.boolean(),
  documents: z.array(ServiceRequestDocumentSchema),

  minioKey: z.string().nullable(),
  pdfGeneratedAt: z.coerce.date().nullable(),
  sentAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  cancelReason: z.string().nullable(),

  createdBy: z.object({ id: z.string(), email: z.string(), displayName: z.string().nullable() }),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ServiceRequestRead = z.infer<typeof ServiceRequestReadSchema>;

export const ServiceRequestDispatchSchema = z.object({
  id: z.string(),
  toAddresses: z.array(z.string()),
  ccAddresses: z.array(z.string()),
  bccAddresses: z.array(z.string()),
  subject: z.string(),
  sentAt: z.coerce.date().nullable(),
  error: z.string().nullable(),
  sentBy: z.object({ id: z.string(), email: z.string() }),
  createdAt: z.coerce.date(),
});
export type ServiceRequestDispatch = z.infer<typeof ServiceRequestDispatchSchema>;
