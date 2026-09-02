import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  NumberInput,
  Select,
  Stack,
  Stepper,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SERVICE_LOCATION_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  ServiceRequestCreateSchema,
  ServiceRequestSendReadinessSchema,
  toSelectOptions,
  requiresAuthorizationDocument,
  resolveServiceLabel,
  type ServiceRequestCreate,
  type ServiceRequestRead,
  type ServiceRequestType,
} from '@portlog/schemas';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { formatDateTime } from '../../../lib/format/datetime';
import {
  blankServiceRequest,
  isMidnight,
  toFormValues,
  withTime,
  type ServiceRequestFormValues,
} from '../formDefaults';
import { ServiceDetailsFields } from './ServiceDetailsFields';
import { AuthorizationDocumentsField } from './AuthorizationDocumentsField';
import { listServiceRequestNominationOptions } from '../api';

const LOCATION_OPTIONS = toSelectOptions(SERVICE_LOCATION_LABELS);

/**
 * The scheduled datetime is one column but four different words depending on
 * which paper form the operator is holding. Relabelling it here is what lets
 * the database keep a single sortable `scheduledAt`.
 */
const SCHEDULED_LABELS: Record<ServiceRequestType, string> = {
  LAUNCH: 'Scheduled Departure Time',
  UNDERWATER_INSPECTION: 'Estimated Start Date and Time',
  BALLAST_WATER: 'Scheduled Date and Time',
  TUG: 'Manoeuvre Time (Pilot on Board)',
  STS: 'Location and ETA — Date and Time',
  GENERAL: 'Start Date and Time',
};

const VOUCHER_LABELS: Record<ServiceRequestType, string> = {
  LAUNCH: 'Physical Voucher No.',
  UNDERWATER_INSPECTION: 'Voucher / Receipt No.',
  BALLAST_WATER: 'Voucher / Receipt No.',
  TUG: 'Tug Ticket No.',
  STS: 'Provider Ticket No.',
  GENERAL: 'Service No. (voucher)',
};

/**
 * The clearable-FK fields are declared with `z.preprocess`, so their *input*
 * type (what the form holds) widens to `{}`. Every one of them is a cuid or
 * empty in practice; this narrows it back for the pickers.
 */
function asId(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

interface Props {
  /** Absent when creating; present when editing an existing draft. */
  request?: ServiceRequestRead;
  type: ServiceRequestType;
  /** The signed-in user's Sucursal — pre-fills step 1. */
  defaultBranchId: string | null;
  isSaving: boolean;
  onSubmit: (values: ServiceRequestCreate) => void;
  onCancel: () => void;
  /** Opens a specific step after navigation, for example Documents after draft creation. */
  initialStep?: number;
}

export function ServiceRequestStepper({
  request,
  type,
  defaultBranchId,
  isSaving,
  onSubmit,
  onCancel,
  initialStep = 0,
}: Props) {
  const [active, setActive] = useState(() => Math.min(Math.max(initialStep, 0), 4));

  // Picker search boxes are local UI state, not form state.
  const [nominationSearch, setNominationSearch] = useState('');
  const [debouncedNominationSearch] = useDebouncedValue(nominationSearch, 300);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [portSearch, setPortSearch] = useState('');
  const [pierSearch, setPierSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedLabels, setSelectedLabels] = useState({
    supplier: request?.supplier?.name ?? '',
    port: request?.port?.name ?? '',
    pier: request?.pier?.name ?? '',
    client: request?.billToClient?.name ?? '',
  });

  const form = useForm<ServiceRequestFormValues>({
    resolver: zodResolver(ServiceRequestCreateSchema),
    defaultValues: request ? toFormValues(request) : blankServiceRequest(type, defaultBranchId),
    mode: 'onBlur',
  });
  const { control, register, handleSubmit, formState, watch, setValue } = form;

  const details = watch('details');
  const portId = watch('portId');
  const supplierId = watch('supplierId');
  const nominationId = watch('nominationId');
  const scheduledAt = watch('scheduledAt');
  const nominationOptions = useQuery({
    queryKey: ['service-requests', 'nomination-options', debouncedNominationSearch],
    queryFn: () => listServiceRequestNominationOptions(debouncedNominationSearch),
    staleTime: 30_000,
  });
  const selectedNomination = nominationOptions.data?.find((item) => item.id === nominationId);
  const authorizationRequired = requiresAuthorizationDocument(details);
  const documentCount = request?.documents.length ?? 0;
  const sendReadiness = ServiceRequestSendReadinessSchema.safeParse({
    supplierId,
    details,
    documentCount,
  });
  const sendBlockers = sendReadiness.success
    ? []
    : sendReadiness.error.issues.map((issue) => issue.message);

  const supplierEmails = request?.supplier?.emails ?? [];

  /**
   * Which fields belong to which step, so "Next" can validate just that step
   * rather than the whole form. Step 4 (billing) is entirely optional and
   * step 5 is a summary, so neither gates progress.
   */
  const stepFields = useMemo(
    () =>
      [
        type === 'GENERAL' ? ['branchId'] : ['shipParticularId', 'branchId', 'nominationId'],
        ['details', 'location', 'portId', 'pierId', 'scheduledAt'],
        [],
        [],
        [],
      ] as Array<Array<keyof ServiceRequestFormValues>>,
    [type],
  );

  async function next() {
    const fields = stepFields[active] ?? [];
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (valid) setActive((s) => Math.min(s + 1, 4));
  }

  const previewLabel = resolveServiceLabel(details);

  return (
    <FormProvider {...form}>
      <form
        onSubmit={handleSubmit((values) => onSubmit(values as ServiceRequestCreate))}
        noValidate
      >
        <Stack gap="lg">
          <Title order={3}>{SERVICE_REQUEST_TYPE_LABELS[type].en}</Title>

          <RequirementGuide authorizationRequired={authorizationRequired} />

          <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false} size="sm">
            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Identification" description="Vessel and branch">
              <Stack gap="sm" mt="md">
                {type === 'GENERAL' ? (
                  <Alert variant="light" color="blue" title="Administrative service">
                    This request is assigned to Administration in your branch. It does not require a
                    vessel, SN or OT.
                  </Alert>
                ) : (
                  <>
                    <Controller
                      name="nominationId"
                      control={control}
                      render={({ field, fieldState }) => (
                        <Select
                          label="SN / OT and vessel"
                          description="Only active nominations from your assigned branch are shown"
                          placeholder="Search or select an SN, OT or vessel"
                          required
                          searchable
                          clearable
                          searchValue={nominationSearch}
                          onSearchChange={setNominationSearch}
                          value={asId(field.value)}
                          data={(nominationOptions.data ?? []).map((item) => ({
                            value: item.id,
                            label: item.label,
                          }))}
                          onChange={(value) => {
                            field.onChange(value);
                            const selected = nominationOptions.data?.find(
                              (item) => item.id === value,
                            );
                            setValue('shipParticularId', selected?.shipParticularId ?? '', {
                              shouldValidate: true,
                            });
                            setValue('branchId', selected?.branchId ?? '', {
                              shouldValidate: true,
                            });
                          }}
                          error={fieldState.error?.message}
                          nothingFoundMessage={
                            nominationOptions.isLoading
                              ? 'Loading...'
                              : 'No branch nominations found'
                          }
                        />
                      )}
                    />

                    <Group grow>
                      <TextInput
                        label="Vessel / Tanker"
                        value={
                          selectedNomination?.vesselName ?? request?.shipParticular?.name ?? ''
                        }
                        readOnly
                      />
                      <TextInput
                        label="Branch"
                        value={selectedNomination?.branchName ?? request?.branch.name ?? ''}
                        readOnly
                      />
                    </Group>
                  </>
                )}

                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/suppliers"
                      label="Provider"
                      placeholder="Provider that will receive the purchase order"
                      value={asId(field.value)}
                      onChange={(value, label) => {
                        field.onChange(value);
                        setSelectedLabels((current) => ({ ...current, supplier: label ?? '' }));
                      }}
                      searchValue={supplierSearch}
                      onSearchChange={setSupplierSearch}
                      selectedOption={
                        request?.supplier
                          ? { value: request.supplier.id, label: request.supplier.name }
                          : null
                      }
                      error={fieldState.error?.message}
                    />
                  )}
                />
                {!supplierId && (
                  <Alert color="orange" variant="light" title="Provider needed before sending">
                    You can save this request as a draft without a provider. Select one before you
                    generate and send the purchase order.
                  </Alert>
                )}
                {/* The spec asks for the provider's address to be visible before
                    sending, so the operator can confirm where the OC will go. */}
                {Boolean(supplierId) && supplierEmails.length > 0 && (
                  <Text size="xs" c="dimmed">
                    The order will be sent to: {supplierEmails.join(', ')}
                  </Text>
                )}

                <Alert variant="light" color="gray">
                  <Text size="sm">
                    The <strong>control number</strong> is generated by the system on save.
                    {request ? ` This one: ${request.controlNumber}.` : ''}
                  </Text>
                </Alert>
              </Stack>
            </Stepper.Step>

            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Service" description="Details and scheduling">
              <Stack gap="sm" mt="md">
                <ServiceDetailsFields type={type} />

                <Divider my="xs" />

                <Text size="xs" c="dimmed">
                  Location, port and berth are optional for the draft and the purchase order. If you
                  add a berth, select its port first.
                </Text>

                <Group grow align="flex-start">
                  <Controller
                    name="location"
                    control={control}
                    render={({ field, fieldState }) => (
                      <Select
                        label="Vessel Location"
                        placeholder="Anchorage, berth, buoy…"
                        data={LOCATION_OPTIONS}
                        clearable
                        value={(field.value as string | undefined) ?? null}
                        onChange={field.onChange}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="portId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Port / Terminal"
                        value={asId(field.value)}
                        onChange={(value, label) => {
                          field.onChange(value);
                          setSelectedLabels((current) => ({ ...current, port: label ?? '' }));
                        }}
                        searchValue={portSearch}
                        onSearchChange={setPortSearch}
                        selectedOption={
                          request?.port
                            ? { value: request.port.id, label: request.port.name }
                            : null
                        }
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="pierId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        // Piers are a nested resource under their port, so the
                        // list is unreachable until a port is chosen.
                        endpoint={`/master-data/ports/${asId(portId) ?? ''}/piers`}
                        label="Berth"
                        disabled={asId(portId) === null}
                        placeholder={asId(portId) ? 'Select the berth' : 'Select a port first'}
                        value={asId(field.value)}
                        onChange={(value, label) => {
                          field.onChange(value);
                          setSelectedLabels((current) => ({ ...current, pier: label ?? '' }));
                        }}
                        searchValue={pierSearch}
                        onSearchChange={setPierSearch}
                        selectedOption={
                          request?.pier
                            ? { value: request.pier.id, label: request.pier.name }
                            : null
                        }
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>

                <Controller
                  name="scheduledAt"
                  control={control}
                  render={({ field, fieldState }) => (
                    <DateTimePicker
                      label={SCHEDULED_LABELS[type]}
                      placeholder="Select date and time"
                      valueFormat="DD/MM/YYYY HH:mm"
                      required
                      value={field.value instanceof Date ? field.value : null}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      timeInputProps={{
                        'aria-label': `${SCHEDULED_LABELS[type]} time`,
                        onBlur: (event) => {
                          // Mantine keeps a draft time inside the popover. Commit
                          // the native input value as it loses focus, including
                          // when the popover is closed without clicking its tick.
                          const committed = withTime(
                            field.value instanceof Date ? field.value : null,
                            event.currentTarget.value,
                          );
                          if (committed) field.onChange(committed);
                          field.onBlur();
                        },
                      }}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                {isMidnight(scheduledAt) && (
                  <Alert color="yellow" variant="light" title="Midnight selected">
                    This request is scheduled for 00:00. You can continue if midnight is
                    intentional; otherwise, choose the required time.
                  </Alert>
                )}
              </Stack>
            </Stepper.Step>

            {/* ------------------------------------------------------------- */}
            <Stepper.Step
              label="Documents"
              description={request ? 'Authorisation and voucher' : 'Added after draft is saved'}
            >
              <Stack gap="sm" mt="md">
                {authorizationRequired ? (
                  <Alert color="orange" variant="light" title="Authorisation required">
                    This service type requires the port authority or government authorisation
                    letter. The purchase order cannot be sent without it.
                  </Alert>
                ) : (
                  <Alert color="gray" variant="light">
                    This service type does not require an authorisation letter. You may still attach
                    supporting documents.
                  </Alert>
                )}

                {request ? (
                  <AuthorizationDocumentsField
                    requestId={request.id}
                    documents={request.documents}
                    disabled={request.status === 'CANCELLED'}
                  />
                ) : (
                  <Alert color="blue" variant="light" title="Documents are added after saving">
                    {authorizationRequired
                      ? 'Create the draft to continue. We will open this Documents step again so you can upload the required authorisation immediately.'
                      : 'Supporting documents are optional. After creating the draft, you can return to this Documents step to add any files.'}
                  </Alert>
                )}

                <TextInput
                  label={VOUCHER_LABELS[type]}
                  description="Optional. Filled in after the service for accounting reconciliation."
                  placeholder="e.g. 6009"
                  error={formState.errors.physicalVoucherNo?.message}
                  {...register('physicalVoucherNo')}
                />

                <Textarea
                  label="Observations"
                  description="Optional instructions or context for the provider."
                  placeholder="Additional instructions — e.g. “Fire-fighting capable tug required (FiFi 1)”"
                  autosize
                  minRows={3}
                  error={formState.errors.notes?.message}
                  {...register('notes')}
                />
              </Stack>
            </Stepper.Step>

            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Billing" description="Optional">
              <Stack gap="sm" mt="md">
                <Alert color="gray" variant="light">
                  Optional. Used for the sales record and to feed the financial module (PDA/FDA);
                  only the estimated cost appears on the purchase order.
                </Alert>
                <Group grow align="flex-start">
                  <Controller
                    name="billToClientId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/clients"
                        label="Bill To (Client)"
                        value={asId(field.value)}
                        onChange={(value, label) => {
                          field.onChange(value);
                          setSelectedLabels((current) => ({ ...current, client: label ?? '' }));
                        }}
                        searchValue={clientSearch}
                        onSearchChange={setClientSearch}
                        selectedOption={
                          request?.billToClient
                            ? { value: request.billToClient.id, label: request.billToClient.name }
                            : null
                        }
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <TextInput
                    label="Currency"
                    maxLength={3}
                    error={formState.errors.currency?.message}
                    {...register('currency')}
                  />
                </Group>
                <Group grow align="flex-start">
                  <Controller
                    name="estimatedCost"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Estimated Cost"
                        min={0}
                        decimalScale={2}
                        hideControls
                        value={(field.value as number | undefined) ?? ''}
                        onChange={(val) => field.onChange(val === '' ? null : Number(val))}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="actualCost"
                    control={control}
                    render={({ field, fieldState }) => (
                      <NumberInput
                        label="Actual Cost"
                        description="Filled in when the voucher is reconciled."
                        min={0}
                        decimalScale={2}
                        hideControls
                        value={(field.value as number | undefined) ?? ''}
                        onChange={(val) => field.onChange(val === '' ? null : Number(val))}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>
              </Stack>
            </Stepper.Step>

            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Review" description="Confirm and save">
              <Stack gap="sm" mt="md">
                <Card withBorder padding="md">
                  <Stack gap={6}>
                    <Text fw={600} size="sm">
                      Identification
                    </Text>
                    <SummaryRow
                      label="Control No."
                      value={request?.controlNumber ?? 'Generated when saved'}
                    />
                    {type !== 'GENERAL' && (
                      <>
                        <SummaryRow
                          label="Nomination"
                          value={selectedNomination?.reference ?? '—'}
                        />
                        <SummaryRow
                          label="Vessel"
                          value={
                            selectedNomination?.vesselName ?? request?.shipParticular?.name ?? '—'
                          }
                        />
                      </>
                    )}
                    <SummaryRow
                      label="Branch"
                      value={
                        selectedNomination?.branchName ??
                        request?.branch.name ??
                        (defaultBranchId ? 'Assigned branch' : '—')
                      }
                    />
                    <SummaryRow label="Provider" value={selectedLabels.supplier || '—'} />

                    <Divider my={4} />
                    <Text fw={600} size="sm">
                      Service
                    </Text>
                    <SummaryRow label="Type" value={SERVICE_REQUEST_TYPE_LABELS[type].en} />
                    <SummaryRow label="Service" value={previewLabel} />
                    {detailSummaryRows(details).map((row) => (
                      <SummaryRow key={row.label} label={row.label} value={row.value} />
                    ))}
                    <SummaryRow
                      label="Scheduled"
                      value={
                        watch('scheduledAt') instanceof Date
                          ? formatDateTime(watch('scheduledAt') as Date)
                          : '—'
                      }
                    />
                    <SummaryRow
                      label="Location"
                      value={
                        watch('location')
                          ? SERVICE_LOCATION_LABELS[
                              watch('location') as keyof typeof SERVICE_LOCATION_LABELS
                            ].en
                          : '—'
                      }
                    />
                    <SummaryRow label="Port / Terminal" value={selectedLabels.port || '—'} />
                    <SummaryRow label="Berth" value={selectedLabels.pier || '—'} />
                    <SummaryRow
                      label="Authorisation"
                      value={
                        authorizationRequired
                          ? documentCount > 0
                            ? `Required — ${documentCount} document(s) uploaded`
                            : 'Required — not yet uploaded'
                          : 'Not required'
                      }
                    />

                    <Divider my={4} />
                    <Text fw={600} size="sm">
                      Billing and notes
                    </Text>
                    <SummaryRow label="Bill To" value={selectedLabels.client || '—'} />
                    <SummaryRow
                      label="Estimated Cost"
                      value={formatMoney(watch('estimatedCost'), watch('currency'))}
                    />
                    <SummaryRow
                      label="Actual Cost"
                      value={formatMoney(watch('actualCost'), watch('currency'))}
                    />
                    <SummaryRow
                      label="Voucher No."
                      value={displayText(watch('physicalVoucherNo'))}
                    />
                    <SummaryRow label="Notes" value={displayText(watch('notes'))} />
                  </Stack>
                </Card>

                {sendBlockers.length > 0 && (
                  <Alert color="orange" variant="light" title="Draft can be saved">
                    Before generating and sending the purchase order: {sendBlockers.join('; ')}.
                  </Alert>
                )}

                {Object.keys(formState.errors).length > 0 && (
                  <Alert color="red" title="Required information is missing">
                    Check the highlighted steps: {Object.keys(formState.errors).join(', ')}.
                  </Alert>
                )}
              </Stack>
            </Stepper.Step>
          </Stepper>

          <Group justify="space-between">
            <Button variant="subtle" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Group>
              {active > 0 && (
                <Button
                  variant="default"
                  onClick={() => setActive((s) => s - 1)}
                  disabled={isSaving}
                >
                  Back
                </Button>
              )}
              {active < 4 ? (
                <Button onClick={() => void next()}>Next</Button>
              ) : (
                <Button type="submit" loading={isSaving}>
                  {request
                    ? 'Save changes'
                    : authorizationRequired
                      ? 'Create draft & add document'
                      : 'Create request'}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </form>
    </FormProvider>
  );
}

function RequirementGuide({ authorizationRequired }: { authorizationRequired: boolean }) {
  return (
    <Card withBorder padding="xs" radius="sm" role="note" aria-label="Field requirement guide">
      <Group gap="xs">
        <Badge size="sm" variant="light" color="red">
          * Required to save
        </Badge>
        <Badge size="sm" variant="light" color="orange">
          Provider required to send
        </Badge>
        <Badge size="sm" variant="light" color={authorizationRequired ? 'orange' : 'gray'}>
          Authorisation {authorizationRequired ? 'required to send' : 'not required'}
        </Badge>
        <Text size="xs" c="dimmed">
          Unmarked fields are optional.
        </Text>
      </Group>
    </Card>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap="xs" wrap="nowrap">
      <Text size="sm" c="dimmed" w={130}>
        {label}
      </Text>
      <Text size="sm">{value}</Text>
    </Group>
  );
}

function formatMoney(value: unknown, currency: unknown): string {
  if (typeof value !== 'number') return '—';
  return `${typeof currency === 'string' && currency ? currency : ''} ${value.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  )}`.trim();
}

function displayText(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value : '—';
}

function humanize(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function enabledLabels(values: Record<string, unknown>): string {
  const labels = Object.entries(values)
    .filter(([, enabled]) => enabled === true)
    .map(([name]) => name.replace(/([A-Z])/g, ' $1').toLowerCase())
    .map((name) => name.charAt(0).toUpperCase() + name.slice(1));
  return labels.length > 0 ? labels.join(', ') : 'None';
}

function detailSummaryRows(details: unknown): Array<{ label: string; value: string }> {
  if (!details || typeof details !== 'object' || !('type' in details)) return [];
  const value = details as Record<string, unknown>;

  switch (value.type) {
    case 'LAUNCH':
      return [
        { label: 'Boats', value: String(value.boatCount ?? '—') },
        { label: 'Departure Point', value: String(value.departurePoint || '—') },
      ];
    case 'UNDERWATER_INSPECTION':
      return [
        { label: 'Method', value: humanize(value.method) },
        {
          label: 'Deliverables',
          value: enabledLabels((value.deliverables ?? {}) as Record<string, unknown>),
        },
      ];
    case 'BALLAST_WATER':
      return [
        { label: 'Tanks', value: String(value.tankCount ?? '—') },
        { label: 'Certified Lab', value: value.requiresCertifiedLab ? 'Yes' : 'No' },
        {
          label: 'Deliverables',
          value: enabledLabels((value.deliverables ?? {}) as Record<string, unknown>),
        },
      ];
    case 'TUG':
      return [{ label: 'Tugs', value: String(value.tugCount ?? '—') }];
    case 'STS':
      return [
        { label: 'Target Vessel', value: String(value.targetVesselName || '—') },
        { label: 'Our Role', value: humanize(value.ourRole) },
        {
          label: 'Product / Quantity',
          value:
            `${value.product || '—'} · ${value.quantity ?? '—'} ${value.quantityUnit ?? ''}`.trim(),
        },
        {
          label: 'Equipment',
          value: enabledLabels((value.equipment ?? {}) as Record<string, unknown>),
        },
        {
          label: 'Spill Prevention',
          value: enabledLabels((value.spillPrevention ?? {}) as Record<string, unknown>),
        },
        {
          label: 'Personnel',
          value: enabledLabels((value.personnel ?? {}) as Record<string, unknown>),
        },
      ];
    case 'GENERAL':
      return [{ label: 'Route', value: String(value.route || '—') }];
    default:
      return [];
  }
}
