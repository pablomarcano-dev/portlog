import {
  BALLAST_ANALYSIS_TYPE_LABELS,
  LAUNCH_SERVICE_TYPE_LABELS,
  SERVICE_LOCATION_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  STS_ROLE_LABELS,
  ServiceRequestDetailsSchema,
  TUG_OPERATION_TYPE_LABELS,
  UNDERWATER_INSPECTION_TYPE_LABELS,
  UNDERWATER_METHOD_LABELS,
  formatControlNumber,
  resolveServiceLabel,
  type ServiceRequestDetails,
} from '@portlog/schemas';

/**
 * One purchase-order template serves all six request types, so the type-specific
 * part of the document is flattened here into an ordered list of label/value
 * rows — the service breakdown every spec asks for. Handlebars then just
 * iterates; no per-type template, no `{{#if}}` ladder.
 *
 * The rows are **Spanish**, unlike the rest of the codebase: this document is
 * read by the Venezuelan launch, tug and diving providers, the same reason the
 * branch-document templates (antidrogas.hbs, solicitud-zarpe.hbs) are Spanish.
 * Every enum label carries both languages; the UI takes `.en`, this file `.es`.
 */
export interface OrderBreakdownRow {
  label: string;
  value: string;
}

/**
 * Handlebars contexts are passed as `Record<string, unknown>`, so the shape
 * carries an index signature; the named fields still typecheck every access in
 * `buildOrderContext`.
 */
export interface OrderContext extends Record<string, unknown> {
  control: string;
  typeLabel: string;
  vessel: { name: string; imo: string | null };
  branch: { name: string; code: string };
  supplier: { name: string; emails: string } | null;
  location: string | null;
  place: string | null;
  scheduledAt: string;
  operation: string;
  originPoint: string | null;
  destinationPoint: string | null;
  contactPersonName: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  generatedAt: string;
  physicalVoucherNo: string | null;
  notes: string | null;
  requestedByAuthority?: boolean | null;
  requestingAuthority?: string | null;
  breakdown: OrderBreakdownRow[];
  documents: string[];
  billing: { client: string | null; estimated: string | null; currency: string } | null;
}

/** The row shape `ServiceRequestsService` passes in — its DETAIL_INCLUDE payload. */
interface OrderSource {
  correlative: number;
  createdAt: Date;
  type: string;
  details: unknown;
  scheduledAt: Date;
  location: string | null;
  originPoint?: string | null;
  destinationPoint?: string | null;
  contactPersonName?: string | null;
  operationDescription?: string | null;
  physicalVoucherNo: string | null;
  notes: string | null;
  requestedByAuthority?: boolean | null;
  requestingAuthority?: string | null;
  currency: string;
  estimatedCost: { toNumber(): number } | null;
  shipParticular: { name: string; imoNumber: string | null } | null;
  branch: { name: string; code: string };
  supplier: { name: string; emails: string[] } | null;
  port: { name: string } | null;
  pier: { name: string } | null;
  billToClient: { name: string } | null;
  documents: Array<{ filename: string }>;
  nomination?: { correlative: number; dateNominated: Date; kind: 'SN' | 'OT' } | null;
  createdBy?: { email: string; displayName: string | null };
  approvedBy?: { email: string; displayName: string | null } | null;
  approvedAt?: Date | null;
  issuedBy?: { email: string; displayName: string | null } | null;
  issuedAt?: Date | null;
}

/** The order is read in Spanish by the provider. */
const yesNo = (value: boolean): string => (value ? 'Sí' : 'No');

/** Checklist rows print the ticked items, or an explicit "Ninguno". */
function checked(entries: Array<[string, boolean]>): string {
  const on = entries.filter(([, value]) => value).map(([label]) => label);
  return on.length > 0 ? on.join(', ') : 'Ninguno';
}

/**
 * 24-hour, day-first — the format the agency uses everywhere. Rendered in UTC
 * because that is how the timestamp is stored; a locale-dependent render would
 * put a different hour on the provider's copy than on the operator's screen.
 */
function formatDateTime(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()} ` +
    `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())} UTC`
  );
}

function buildBreakdown(details: ServiceRequestDetails): OrderBreakdownRow[] {
  switch (details.type) {
    case 'LAUNCH':
      return [
        { label: 'Tipo de Servicio', value: LAUNCH_SERVICE_TYPE_LABELS[details.serviceType].es },
        { label: 'Cantidad de Lanchas', value: String(details.boatCount) },
      ];

    case 'UNDERWATER_INSPECTION':
      return [
        {
          label: 'Tipo de Inspección',
          value: UNDERWATER_INSPECTION_TYPE_LABELS[details.inspectionType].es,
        },
        { label: 'Método Requerido', value: UNDERWATER_METHOD_LABELS[details.method].es },
        {
          label: 'Entregables',
          value: checked([
            ['Video CCTV en vivo', details.deliverables.liveCctv],
            ['Fotos', details.deliverables.photos],
            ['Informe Técnico', details.deliverables.technicalReport],
          ]),
        },
      ];

    case 'BALLAST_WATER':
      return [
        {
          label: 'Tipo de Servicio / Análisis',
          value: BALLAST_ANALYSIS_TYPE_LABELS[details.analysisType].es,
        },
        { label: 'Número de Tanques a Inspeccionar', value: String(details.tankCount) },
        { label: '¿Requiere Laboratorio Certificado?', value: yesNo(details.requiresCertifiedLab) },
        {
          label: 'Entregables',
          value: checked([
            ['Fotos', details.deliverables.photos],
            ['Informe Técnico', details.deliverables.technicalReport],
          ]),
        },
      ];

    case 'TUG':
      return [
        { label: 'Tipo de Operación', value: TUG_OPERATION_TYPE_LABELS[details.operationType].es },
        { label: 'Cantidad de Remolcadores', value: String(details.tugCount) },
      ];

    case 'STS':
      return [
        { label: 'Buque Contraparte (Target Vessel)', value: details.targetVesselName },
        { label: 'Rol de Nuestro Buque', value: STS_ROLE_LABELS[details.ourRole].es },
        {
          label: 'Producto y Cantidad',
          value: `${details.product} / ${details.quantity.toLocaleString('es-VE')} ${details.quantityUnit}`,
        },
        {
          label: 'Equipos',
          value: checked([
            ['Defensas (Fenders)', details.equipment.fenders],
            ['Mangueras', details.equipment.hoses],
            ['Reductores', details.equipment.reducers],
          ]),
        },
        {
          label: 'Prevención de Derrames',
          value: checked([
            ['Despliegue de Barreras Flotantes', details.spillPrevention.floatingBarriers],
            ['Bote de vigilancia', details.spillPrevention.watchBoat],
          ]),
        },
        {
          label: 'Personal',
          value: checked([
            ['Mooring Master', details.personnel.mooringMaster],
            ['Técnicos de conexión', details.personnel.connectionTechnicians],
          ]),
        },
      ];

    case 'GENERAL':
      return [
        { label: 'Servicio', value: details.serviceName ?? 'Transporte / Otros servicios' },
        ...(details.route ? [{ label: 'Servicio Recorrido', value: details.route }] : []),
      ];
  }
}

export function buildOrderContext(row: OrderSource): OrderContext {
  const parsed = ServiceRequestDetailsSchema.safeParse(row.details);

  return {
    control: formatControlNumber(row.correlative, row.createdAt, row.branch.code),
    typeLabel:
      SERVICE_REQUEST_TYPE_LABELS[row.type as keyof typeof SERVICE_REQUEST_TYPE_LABELS]?.es ??
      row.type,
    vessel: {
      name: row.shipParticular?.name ?? 'Administración',
      imo: row.shipParticular?.imoNumber ?? null,
    },
    branch: { name: row.branch.name, code: row.branch.code },
    supplier: row.supplier
      ? { name: row.supplier.name, emails: row.supplier.emails.join(', ') }
      : null,
    location:
      row.location == null
        ? null
        : (SERVICE_LOCATION_LABELS[row.location as keyof typeof SERVICE_LOCATION_LABELS]?.es ??
          row.location),
    // The concrete berth, when one is known — "Muelle 3, Puerto La Cruz".
    place: [row.pier?.name, row.port?.name].filter(Boolean).join(', ') || null,
    scheduledAt: formatDateTime(row.scheduledAt),
    operation: row.operationDescription?.trim() || resolveServiceLabel(row.details, 'es'),
    originPoint:
      row.originPoint ??
      (parsed.success && parsed.data.type === 'LAUNCH'
        ? (parsed.data.departurePoint ?? null)
        : null),
    destinationPoint: row.destinationPoint ?? null,
    contactPersonName: row.contactPersonName ?? null,
    approvedBy: row.approvedBy ? row.approvedBy.displayName?.trim() || row.approvedBy.email : null,
    approvedAt: row.approvedAt ? formatDateTime(row.approvedAt) : null,
    generatedAt: formatDateTime(new Date()),
    physicalVoucherNo: row.physicalVoucherNo,
    notes: row.notes,
    requestedByAuthority: row.requestedByAuthority,
    requestingAuthority: row.requestingAuthority,
    breakdown: parsed.success
      ? buildBreakdown(parsed.data)
      : [{ label: 'Servicio', value: resolveServiceLabel(row.details) }],
    documents: row.documents.map((doc) => doc.filename),
    billing:
      row.billToClient || row.estimatedCost
        ? {
            client: row.billToClient?.name ?? null,
            estimated: row.estimatedCost == null ? null : row.estimatedCost.toNumber().toFixed(2),
            currency: row.currency,
          }
        : null,
  };
}

/** Values for the retained SNCA-RG-AGN-005 Word form. Signature and receipt
 * fields remain on the form for the people who actually sign it. */
export function buildOperationalOrderData(
  row: OrderSource,
  issuer?: { name: string; at: Date },
): Record<string, string> {
  const context = buildOrderContext(row);
  const parsed = ServiceRequestDetailsSchema.safeParse(row.details);
  const details = parsed.success ? parsed.data : null;
  const quantity =
    details?.type === 'LAUNCH'
      ? details.boatCount
      : details?.type === 'TUG'
        ? details.tugCount
        : details?.type === 'BALLAST_WATER'
          ? details.tankCount
          : 1;
  const items = [{ description: context.operation, quantity: String(quantity) }];
  const observations = [
    ...context.breakdown
      .filter(
        ({ label }) =>
          ![
            'Cantidad de Lanchas',
            'Cantidad de Remolcadores',
            'Número de Tanques a Inspeccionar',
            'Punto de Salida',
          ].includes(label),
      )
      .map(({ label, value }) => `${label}: ${value}`),
    ...(row.requestedByAuthority && row.requestingAuthority
      ? [`Solicitado por: ${row.requestingAuthority}`]
      : []),
    ...(row.notes ? [row.notes] : []),
  ].join(' · ');
  const date = (value: Date) =>
    `${String(value.getUTCDate()).padStart(2, '0')}/${String(value.getUTCMonth() + 1).padStart(2, '0')}/${value.getUTCFullYear()}`;

  const data: Record<string, string> = {
    snOt: row.nomination
      ? `${row.nomination.kind}-${String(row.nomination.dateNominated.getUTCFullYear()).slice(-2)}/${String(row.nomination.correlative).padStart(4, '0')}`
      : '',
    orderNumber: context.control,
    vessel: context.vessel.name,
    supplier: context.supplier?.name ?? '',
    branch: context.branch.name,
    executionDate: date(row.scheduledAt),
    operation: context.operation,
    terminal: [context.location, context.place].filter(Boolean).join(' — '),
    departure: context.originPoint ?? '',
    destination: context.destinationPoint ?? '',
    startTime: `${String(row.scheduledAt.getUTCHours()).padStart(2, '0')}:${String(row.scheduledAt.getUTCMinutes()).padStart(2, '0')} UTC`,
    contact: context.contactPersonName ?? '',
    observations,
    agent:
      issuer?.name ||
      row.issuedBy?.displayName?.trim() ||
      row.issuedBy?.email ||
      row.createdBy?.displayName?.trim() ||
      row.createdBy?.email ||
      '',
    preparationDate: date(issuer?.at ?? row.issuedAt ?? new Date()),
    approver: context.approvedBy ?? '',
    approvalDate: row.approvedAt ? date(row.approvedAt) : '',
  };
  for (let index = 0; index < 5; index += 1) {
    data[`item${index + 1}Description`] = items[index]?.description ?? '';
    data[`item${index + 1}Quantity`] = items[index]?.quantity ?? '';
  }
  return data;
}
