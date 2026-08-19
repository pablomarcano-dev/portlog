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
  physicalVoucherNo: string | null;
  notes: string | null;
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
  physicalVoucherNo: string | null;
  notes: string | null;
  currency: string;
  estimatedCost: { toNumber(): number } | null;
  shipParticular: { name: string; imoNumber: string | null };
  branch: { name: string; code: string };
  supplier: { name: string; emails: string[] } | null;
  port: { name: string } | null;
  pier: { name: string } | null;
  billToClient: { name: string } | null;
  documents: Array<{ filename: string }>;
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
        ...(details.departurePoint
          ? [{ label: 'Punto de Salida', value: details.departurePoint }]
          : []),
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
      return details.route ? [{ label: 'Servicio Recorrido', value: details.route }] : [];
  }
}

export function buildOrderContext(row: OrderSource): OrderContext {
  const parsed = ServiceRequestDetailsSchema.safeParse(row.details);

  return {
    control: formatControlNumber(row.correlative, row.createdAt, row.branch.code),
    typeLabel:
      SERVICE_REQUEST_TYPE_LABELS[row.type as keyof typeof SERVICE_REQUEST_TYPE_LABELS]?.es ??
      row.type,
    vessel: { name: row.shipParticular.name, imo: row.shipParticular.imoNumber },
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
    physicalVoucherNo: row.physicalVoucherNo,
    notes: row.notes,
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
