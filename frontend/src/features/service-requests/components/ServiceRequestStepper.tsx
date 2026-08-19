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
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  SERVICE_LOCATION_LABELS,
  SERVICE_REQUEST_TYPE_LABELS,
  ServiceRequestCreateSchema,
  toSelectOptions,
  requiresAuthorizationDocument,
  resolveServiceLabel,
  type ServiceRequestCreate,
  type ServiceRequestRead,
  type ServiceRequestType,
} from '@portlog/schemas';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { formatDateTime } from '../../../lib/format/datetime';
import { blankServiceRequest, toFormValues, type ServiceRequestFormValues } from '../formDefaults';
import { ServiceDetailsFields } from './ServiceDetailsFields';
import { AuthorizationDocumentsField } from './AuthorizationDocumentsField';

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
}

export function ServiceRequestStepper({
  request,
  type,
  defaultBranchId,
  isSaving,
  onSubmit,
  onCancel,
}: Props) {
  const [active, setActive] = useState(0);

  // Picker search boxes are local UI state, not form state.
  const [vesselSearch, setVesselSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [supplierSearch, setSupplierSearch] = useState('');
  const [portSearch, setPortSearch] = useState('');
  const [pierSearch, setPierSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const form = useForm<ServiceRequestFormValues>({
    resolver: zodResolver(ServiceRequestCreateSchema),
    defaultValues: request ? toFormValues(request) : blankServiceRequest(type, defaultBranchId),
    mode: 'onBlur',
  });
  const { control, register, handleSubmit, formState, watch } = form;

  const details = watch('details');
  const portId = watch('portId');
  const supplierId = watch('supplierId');
  const authorizationRequired = requiresAuthorizationDocument(details);
  const documentCount = request?.documents.length ?? 0;

  const supplierEmails = request?.supplier?.emails ?? [];

  /**
   * Which fields belong to which step, so "Next" can validate just that step
   * rather than the whole form. Step 4 (billing) is entirely optional and
   * step 5 is a summary, so neither gates progress.
   */
  const stepFields = useMemo(
    () =>
      [
        ['shipParticularId', 'branchId', 'nominationId'],
        ['details', 'location', 'portId', 'pierId', 'scheduledAt'],
        [],
        [],
        [],
      ] as Array<Array<keyof ServiceRequestFormValues>>,
    [],
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
          <Group justify="space-between" align="center">
            <div>
              <Title order={3}>{SERVICE_REQUEST_TYPE_LABELS[type].en}</Title>
              {request && (
                <Text size="sm" c="dimmed">
                  Control No. <strong>{request.controlNumber}</strong>
                </Text>
              )}
            </div>
            {request && <Badge variant="light">{request.status}</Badge>}
          </Group>

          <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false} size="sm">
            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Identification" description="Vessel and branch">
              <Stack gap="sm" mt="md">
                <Group grow align="flex-start">
                  <Controller
                    name="shipParticularId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ship-particulars"
                        label="Vessel / Tanker"
                        required
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={vesselSearch}
                        onSearchChange={setVesselSearch}
                        selectedOption={
                          request
                            ? {
                                value: request.shipParticularId,
                                label: request.shipParticular.name,
                              }
                            : null
                        }
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name="branchId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/branches"
                        label="Branch"
                        required
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={branchSearch}
                        onSearchChange={setBranchSearch}
                        selectedOption={
                          request ? { value: request.branchId, label: request.branch.name } : null
                        }
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Group>

                <Controller
                  name="supplierId"
                  control={control}
                  render={({ field, fieldState }) => (
                    <EntityPicker
                      endpoint="/master-data/suppliers"
                      label="Provider"
                      placeholder="Provider that will receive the purchase order"
                      value={asId(field.value)}
                      onChange={field.onChange}
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
                        onChange={field.onChange}
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
                        onChange={field.onChange}
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
                      error={fieldState.error?.message}
                    />
                  )}
                />
              </Stack>
            </Stepper.Step>

            {/* ------------------------------------------------------------- */}
            <Stepper.Step label="Documents" description="Authorisation and voucher">
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
                  <Alert color="blue" variant="light">
                    Save the request first — attachments are uploaded against a request that already
                    exists.
                  </Alert>
                )}

                <TextInput
                  label={VOUCHER_LABELS[type]}
                  description="Filled in after the service, for accounting reconciliation."
                  placeholder="e.g. 6009"
                  error={formState.errors.physicalVoucherNo?.message}
                  {...register('physicalVoucherNo')}
                />

                <Textarea
                  label="Observations"
                  placeholder="Additional instructions â e.g. “Fire-fighting capable tug required (FiFi 1)”"
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
                        onChange={field.onChange}
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
                    <SummaryRow label="Type" value={SERVICE_REQUEST_TYPE_LABELS[type].en} />
                    <SummaryRow label="Service" value={previewLabel} />
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
                  </Stack>
                </Card>

                {authorizationRequired && documentCount === 0 && (
                  <Alert color="orange" variant="light">
                    You can save the request, but the purchase order cannot be sent until the
                    authorisation letter is uploaded.
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
                  {request ? 'Save changes' : 'Create request'}
                </Button>
              )}
            </Group>
          </Group>
        </Stack>
      </form>
    </FormProvider>
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
