import { useState, useEffect } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Fieldset,
  Grid,
  Group,
  Select,
  Stack,
  Table,
  TagsInput,
  Textarea,
  TextInput,
  Tooltip,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { DatePickerInput } from '@mantine/dates';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  NominationCreateSchema,
  vesselProDataSchema,
  vesselOwnershipSchema,
} from '@portlog/schemas';
import type { NominationCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { EmailGroupPicker } from '../../../components/master-data/EmailGroupPicker';
import { ContactNamePicker } from '../../../components/master-data/ContactNamePicker';
import { ClientNamePicker } from '../../../components/master-data/ClientNamePicker';
import { ClientPickerModal } from '../../../components/master-data/ClientPickerModal';
import { ParcelsFieldArray } from './ParcelsFieldArray';
import { NewShipParticularModal } from './NewShipParticularModal';
import { NewPortModal } from './NewPortModal';
import { NewPierModal } from './NewPierModal';

const NOMINATION_TYPE_OPTIONS = [
  { value: 'FULL_AGENCY', label: 'Full Agency' },
  { value: 'OWNERS_AGENTS_ONLY', label: "Owner's Agents" },
  { value: 'CHARTERERS_AGENTS_ONLY', label: "Charterer's Agents" },
];

// SN or OT series. Chosen on create, then locked — OT restricts parcels to OT products.
const NOMINATION_KIND_OPTIONS = [
  { value: 'SN', label: 'SN' },
  { value: 'OT', label: 'OT' },
];

function matchPort(
  ports: { id: string; name: string; abbreviation: string | null }[],
  name: string | null | undefined,
): string | null {
  if (!name) return null;
  const norm = name.toLowerCase().trim();
  return (
    ports.find(
      (p) =>
        p.name.toLowerCase() === norm ||
        p.abbreviation?.toLowerCase() === norm ||
        p.name.toLowerCase().includes(norm) ||
        norm.includes(p.name.toLowerCase()),
    )?.id ?? null
  );
}

// Client-type rows pre-populated on every new nomination. Operators can add
// any further types (predefined or custom) separately via "+ Add row".
const DEFAULT_CLIENT_TYPES = ['Charterer', 'Disponent Owner', 'Commercial Operator', 'Shipper'];

// Suggested types offered when adding a client row manually — the former
// defaults plus other common roles. Free text is still allowed.
const ADDITIONAL_CLIENT_TYPES = [
  'Head Owner',
  'Technical Operator',
  'Manning Agents',
  'Catering Agents',
  'Ship Management',
  'Hub Agents',
  'Administrative Agents',
  'Time Charter',
  'Receivers',
];

interface NominationFormProps {
  mode: 'create' | 'edit';
  defaultValues?: Partial<NominationCreateInput>;
  onSubmit: (vals: NominationCreateInput) => void;
  isSubmitting: boolean;
  isReadOnly?: boolean;
  /** Auto-assigned correlative number to show as read-only in edit mode. */
  correlative?: number;
}

export function NominationForm({
  mode,
  defaultValues,
  onSubmit,
  isSubmitting,
  isReadOnly = false,
  correlative,
}: NominationFormProps) {
  const navigate = useNavigate();
  const [newShipModalOpen, setNewShipModalOpen] = useState(false);
  const [portModalTarget, setPortModalTarget] = useState<
    'opPortId' | 'lastPortId' | 'nextPortId' | null
  >(null);
  const [newPierModalOpen, setNewPierModalOpen] = useState(false);

  const defaultClients =
    mode === 'create'
      ? DEFAULT_CLIENT_TYPES.map((type, i) => ({ type, name: '', sortOrder: i }))
      : [];

  const form = useForm<NominationCreateInput>({
    resolver: zodResolver(NominationCreateSchema),
    defaultValues: {
      nominationType: 'FULL_AGENCY',
      kind: 'SN',
      parcels: [],
      nominationClients: defaultClients,
      ...defaultValues,
    },
  });

  const { register, handleSubmit, control, reset, formState, watch, setValue } = form;

  const {
    fields: clientFields,
    append: appendClient,
    remove: removeClient,
  } = useFieldArray({ control, name: 'nominationClients' });

  const shipParticularId = watch('shipParticularId');
  const opPortId = watch('opPortId') ?? null;
  const branchId = watch('branchId');
  const kind = watch('kind') ?? 'SN';

  // Fetch vessel details (IMO + name + abbreviation) for vessel data fetch and subject generation
  const shipQuery = useQuery({
    queryKey: ['ship-particulars', shipParticularId],
    queryFn: () =>
      apiRequest<{ imoNumber: string | null; name: string; abbreviation: string | null }>(
        `/master-data/ship-particulars/${shipParticularId}`,
      ),
    enabled: !!shipParticularId,
    staleTime: 60_000,
  });
  const shipImo = shipQuery.data?.imoNumber ?? null;
  const hasValidImo = !!shipImo && /^\d{7}$/.test(shipImo);

  // Fetch branch details for subject generation (code field)
  const branchQuery = useQuery({
    queryKey: ['branch', branchId],
    queryFn: () =>
      apiRequest<{ id: string; name: string; code: string }>(`/master-data/branches/${branchId}`),
    enabled: !!branchId,
    staleTime: 5 * 60_000,
  });

  // Ports list — used for vessel-data port matching and subject generation
  const portsQuery = useQuery({
    queryKey: ['ports-for-vessel-fetch'],
    queryFn: () =>
      apiRequest<{ items: { id: string; name: string; abbreviation: string | null }[] }>(
        '/master-data/ports?limit=200',
      ),
    staleTime: 5 * 60_000,
  });

  function buildSubject(): string {
    const ship = shipQuery.data;
    const branch = branchQuery.data;
    const port = portsQuery.data?.items.find((p) => p.id === opPortId);
    const shipName = ship?.name ?? '';
    const portName = port?.name ?? '';
    const branchCode = branch?.code ?? '';
    const yy = String(new Date().getFullYear()).slice(-2);
    const corrStr = correlative != null ? String(correlative) : '';
    const kindPrefix = kind === 'OT' ? 'OT' : 'SN';
    return `${shipName} - Calling to ${portName} ${kindPrefix}${corrStr}/${yy}/${branchCode}`;
  }

  // Auto-fill subject in create mode when it's still empty and we have enough data
  useEffect(() => {
    if (mode !== 'create') return;
    if (!shipQuery.data || !branchQuery.data || !portsQuery.data || !opPortId) return;
    const current = (form.getValues('subject') ?? '').trim();
    if (current !== '') return;
    setValue('subject', buildSubject(), { shouldDirty: true });
  }, [shipQuery.data, branchQuery.data, portsQuery.data, opPortId]);

  const [isFetchingVessel, setIsFetchingVessel] = useState(false);
  const [clientPickerIndex, setClientPickerIndex] = useState<number | null>(null);

  async function handleFetchFromVessel() {
    if (!shipImo) return;
    setIsFetchingVessel(true);
    try {
      const [proRaw, ownerRaw] = await Promise.allSettled([
        apiRequest<unknown>(`/datalastic/vessel_pro?imo=${shipImo}`),
        apiRequest<unknown>(`/datalastic/ownership?imo=${shipImo}`),
      ]);

      let filled = 0;
      const ports = portsQuery.data?.items ?? [];

      // vessel_pro → ETA and ports
      if (proRaw.status === 'fulfilled') {
        const envelope = proRaw.value as { data: unknown };
        const parsed = vesselProDataSchema.safeParse(envelope?.data ?? proRaw.value);
        if (parsed.success && parsed.data != null) {
          const v = parsed.data;
          if (v.eta_UTC) {
            setValue('etaDate', new Date(v.eta_UTC), { shouldDirty: true });
            filled++;
          }
          const lastPortId = matchPort(ports, v.dep_port);
          if (lastPortId) {
            setValue('lastPortId', lastPortId, { shouldDirty: true });
            filled++;
          }
          const nextPortId = matchPort(ports, v.dest_port);
          if (nextPortId) {
            setValue('nextPortId', nextPortId, { shouldDirty: true });
            filled++;
          }
        }
      }

      // ownership → fill matching client rows by type
      if (ownerRaw.status === 'fulfilled') {
        const ownerEnvelope = ownerRaw.value as { data: unknown };
        const ownerData = Array.isArray(ownerEnvelope?.data)
          ? ownerEnvelope.data[0]
          : ownerEnvelope?.data;
        const ownership = vesselOwnershipSchema.safeParse(ownerData);
        if (ownership.success && ownership.data != null) {
          const o = ownership.data;
          // Map Datalastic ownership fields to our default client type names
          const typeToName: Record<string, string | null | undefined> = {
            'Head Owner': o.beneficial_owner,
            'Technical Operator': o.technical_manager,
            'Commercial Operator': o.commercial_manager ?? o.operator,
          };
          clientFields.forEach((field, index) => {
            const name = typeToName[field.type];
            if (name) {
              setValue(`nominationClients.${index}.name`, name, { shouldDirty: true });
              filled++;
            }
          });
        }
      }

      if (filled === 0) {
        notifications.show({
          color: 'yellow',
          message: 'Vessel found but no matching fields to fill.',
        });
      } else {
        notifications.show({
          color: 'green',
          message: `Updated ${filled} field${filled > 1 ? 's' : ''} from vessel data.`,
        });
      }
    } catch {
      notifications.show({
        color: 'red',
        message: 'Failed to fetch vessel data. Please try again.',
      });
    } finally {
      setIsFetchingVessel(false);
    }
  }

  // Search state for each EntityPicker
  const [shipSearch, setShipSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [opPortSearch, setOpPortSearch] = useState('');
  const [pierSearch, setPierSearch] = useState('');
  const [lastPortSearch, setLastPortSearch] = useState('');
  const [nextPortSearch, setNextPortSearch] = useState('');

  // Clear pier selection whenever the operational port changes
  useEffect(() => {
    setValue('pierId', undefined);
    setPierSearch('');
  }, [opPortId, setValue]);

  function handleShipCreated(id: string) {
    setValue('shipParticularId', id, { shouldValidate: true });
    setShipSearch('');
  }

  function handlePortCreated(id: string) {
    if (portModalTarget === null) return;
    setValue(portModalTarget, id, { shouldValidate: true, shouldDirty: true });
    if (portModalTarget === 'opPortId') setOpPortSearch('');
    if (portModalTarget === 'lastPortId') setLastPortSearch('');
    if (portModalTarget === 'nextPortId') setNextPortSearch('');
    setPortModalTarget(null);
  }

  function handlePierCreated(id: string) {
    setValue('pierId', id, { shouldValidate: true, shouldDirty: true });
    setPierSearch('');
  }

  return (
    <>
      <NewShipParticularModal
        opened={newShipModalOpen}
        onClose={() => setNewShipModalOpen(false)}
        onCreated={(id) => handleShipCreated(id)}
      />
      <NewPortModal
        opened={portModalTarget !== null}
        onClose={() => setPortModalTarget(null)}
        onCreated={(id) => handlePortCreated(id)}
      />
      <NewPierModal
        opened={newPierModalOpen}
        portId={opPortId}
        onClose={() => setNewPierModalOpen(false)}
        onCreated={(id) => handlePierCreated(id)}
      />
      <ClientPickerModal
        opened={clientPickerIndex !== null}
        onClose={() => setClientPickerIndex(null)}
        onSelect={(name) => {
          if (clientPickerIndex !== null) {
            setValue(`nominationClients.${clientPickerIndex}.name`, name, { shouldDirty: true });
          }
        }}
      />

      <form id="nomination-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <Stack gap="xs">
          {/* Row 1 — Number / Branch / Lay Days */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={2}>
              <TextInput
                label="Number"
                value={correlative ?? ''}
                readOnly
                disabled
                placeholder="Auto"
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Controller
                name="kind"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Kind"
                    data={NOMINATION_KIND_OPTIONS}
                    value={field.value ?? 'SN'}
                    onChange={(val) => field.onChange(val ?? 'SN')}
                    // Locked after creation — kind is immutable once a nomination exists.
                    disabled={mode === 'edit' || isReadOnly}
                    allowDeselect={false}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={4}>
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
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Controller
                name="layDaysFirst"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Lay Days"
                    placeholder="From"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Controller
                name="layDaysLast"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="to"
                    placeholder="To"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
          </Grid>

          {/* Row 2 — Ship's Name / Nom. Date / Nom. Reply / Type */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={5}>
              <Group gap={4} align="flex-end" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Controller
                    name="shipParticularId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ship-particulars"
                        label="Ship's Name"
                        required
                        value={field.value ?? null}
                        onChange={(val) => field.onChange(val ?? '')}
                        searchValue={shipSearch}
                        onSearchChange={setShipSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
                {!isReadOnly && (
                  <Tooltip label="New ship particular">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      mb={formState.errors.shipParticularId ? 20 : 0}
                      onClick={() => setNewShipModalOpen(true)}
                    >
                      +
                    </ActionIcon>
                  </Tooltip>
                )}
                {!isReadOnly && hasValidImo && (
                  <Tooltip label="Fetch ETA and port info from Datalastic" withArrow>
                    <Button
                      size="sm"
                      variant="default"
                      loading={isFetchingVessel}
                      onClick={() => void handleFetchFromVessel()}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      Fetch from vessel
                    </Button>
                  </Tooltip>
                )}
                {!isReadOnly && shipParticularId && !hasValidImo && !shipQuery.isLoading && (
                  <Text size="xs" c="dimmed" style={{ alignSelf: 'flex-end' }}>
                    No IMO
                  </Text>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span={3}>
              <Controller
                name="dateNominated"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Nom. Date"
                    required
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Controller
                name="nomReply"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="Nom. Reply"
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={2}>
              <Controller
                name="nominationType"
                control={control}
                render={({ field, fieldState }) => (
                  <Select
                    label="Type"
                    data={NOMINATION_TYPE_OPTIONS}
                    value={field.value ?? null}
                    onChange={(val) => field.onChange(val ?? 'FULL_AGENCY')}
                    disabled={isReadOnly}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
          </Grid>

          {/* Row 3 — Op. Port / Berth / External Port */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={4}>
              <Group gap={4} align="flex-end" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Controller
                    name="opPortId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Oper. Port"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={opPortSearch}
                        onSearchChange={setOpPortSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
                {!isReadOnly && (
                  <Tooltip label="New port">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={() => setPortModalTarget('opPortId')}
                    >
                      +
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Group gap={4} align="flex-end" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Controller
                    name="pierId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint={
                          opPortId ? `/master-data/ports/${opPortId}/piers` : '/master-data/ports'
                        }
                        label="Pier"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={pierSearch}
                        onSearchChange={setPierSearch}
                        error={fieldState.error?.message}
                        disabled={!opPortId}
                        placeholder={opPortId ? 'Search piers...' : 'Select Oper. Port first'}
                      />
                    )}
                  />
                </div>
                {!isReadOnly && (
                  <Tooltip label={opPortId ? 'New pier' : 'Select Oper. Port first'}>
                    <ActionIcon
                      variant="default"
                      size="lg"
                      disabled={!opPortId}
                      onClick={() => setNewPierModalOpen(true)}
                    >
                      +
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Grid.Col>
          </Grid>

          {/* Row 4 — Last Port / Next Port / ETA */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={4}>
              <Group gap={4} align="flex-end" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Controller
                    name="lastPortId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Last Port"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={lastPortSearch}
                        onSearchChange={setLastPortSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
                {!isReadOnly && (
                  <Tooltip label="New port">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={() => setPortModalTarget('lastPortId')}
                    >
                      +
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Group gap={4} align="flex-end" wrap="nowrap">
                <div style={{ flex: 1 }}>
                  <Controller
                    name="nextPortId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/ports"
                        label="Next Port"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={nextPortSearch}
                        onSearchChange={setNextPortSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </div>
                {!isReadOnly && (
                  <Tooltip label="New port">
                    <ActionIcon
                      variant="default"
                      size="lg"
                      onClick={() => setPortModalTarget('nextPortId')}
                    >
                      +
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Grid.Col>
            <Grid.Col span={4}>
              <Controller
                name="etaDate"
                control={control}
                render={({ field, fieldState }) => (
                  <DatePickerInput
                    label="E.T.A."
                    disabled={isReadOnly}
                    value={field.value instanceof Date ? field.value : null}
                    onChange={(val) => field.onChange(val)}
                    error={fieldState.error?.message}
                    clearable
                  />
                )}
              />
            </Grid.Col>
          </Grid>

          {/* Row 5 — M.I.C. / Boarding / Mobile on Board */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={4}>
              <Controller
                name="mic"
                control={control}
                render={({ field, fieldState }) => (
                  <ContactNamePicker
                    label="M.I.C."
                    placeholder="MIC officer"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    disabled={isReadOnly}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Controller
                name="boardingClerk"
                control={control}
                render={({ field, fieldState }) => (
                  <ContactNamePicker
                    label="Boarding"
                    placeholder="Boarding clerk"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    disabled={isReadOnly}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Mobile on Board"
                placeholder="e.g. +1 555 0100"
                disabled={isReadOnly}
                error={formState.errors.mobileOnBoard?.message}
                {...register('mobileOnBoard')}
              />
            </Grid.Col>
          </Grid>

          {/* Row 6 — Captain / Inspector / Reference Nº */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={4}>
              <TextInput
                label="Captain"
                placeholder="Captain name"
                disabled={isReadOnly}
                error={formState.errors.master?.message}
                {...register('master')}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <Controller
                name="inspector"
                control={control}
                render={({ field, fieldState }) => (
                  <ContactNamePicker
                    label="Inspector"
                    placeholder="Inspector name"
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    disabled={isReadOnly}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={4}>
              <TextInput
                label="Reference Nº"
                placeholder="Reference number"
                disabled={isReadOnly}
                error={formState.errors.referenceNo?.message}
                {...register('referenceNo')}
              />
            </Grid.Col>
          </Grid>

          {/* Row 7 — Subject */}
          <Stack gap={4}>
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>
                Subject
              </Text>
              {!isReadOnly && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  onClick={() => setValue('subject', buildSubject(), { shouldDirty: true })}
                >
                  Generate
                </Button>
              )}
            </Group>
            <Textarea
              placeholder="Email subject or notes"
              autosize
              minRows={2}
              disabled={isReadOnly}
              error={formState.errors.subject?.message}
              {...register('subject')}
            />
          </Stack>

          {/* Clients — inline table, create mode only */}
          {mode === 'create' && (
            <Fieldset legend="Clients">
              <Table withColumnBorders withTableBorder striped>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: 180 }}>Type</Table.Th>
                    <Table.Th>Name</Table.Th>
                    <Table.Th style={{ width: 100 }}>Voy.</Table.Th>
                    <Table.Th style={{ width: 120 }}>Ref. No.</Table.Th>
                    <Table.Th style={{ width: 40 }} />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {clientFields.map((field, index) => {
                    const isDefault = index < DEFAULT_CLIENT_TYPES.length;
                    return (
                      <Table.Tr key={field.id}>
                        <Table.Td>
                          {isDefault ? (
                            <TextInput size="xs" value={field.type} readOnly disabled />
                          ) : (
                            <Controller
                              control={control}
                              name={`nominationClients.${index}.type`}
                              render={({ field: typeField }) => (
                                <Autocomplete
                                  size="xs"
                                  placeholder="Type"
                                  data={ADDITIONAL_CLIENT_TYPES}
                                  value={typeField.value}
                                  onChange={typeField.onChange}
                                />
                              )}
                            />
                          )}
                        </Table.Td>
                        <Table.Td>
                          <Controller
                            control={control}
                            name={`nominationClients.${index}.name`}
                            render={({ field }) => (
                              <ClientNamePicker
                                placeholder="Name"
                                value={field.value}
                                onChange={field.onChange}
                                size="xs"
                                rightSection={
                                  <ActionIcon
                                    size="xs"
                                    variant="subtle"
                                    onClick={() => setClientPickerIndex(index)}
                                    title="Browse clients"
                                  >
                                    ⌕
                                  </ActionIcon>
                                }
                              />
                            )}
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            placeholder="Voy."
                            {...register(`nominationClients.${index}.voyageRef`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="xs"
                            placeholder="Ref. No."
                            {...register(`nominationClients.${index}.referenceNo`)}
                          />
                        </Table.Td>
                        <Table.Td>
                          {!isDefault && (
                            <ActionIcon
                              size="sm"
                              color="red"
                              variant="subtle"
                              onClick={() => removeClient(index)}
                              title="Remove row"
                              aria-label="Remove client row"
                            >
                              ×
                            </ActionIcon>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
              <Group mt="xs">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() =>
                    appendClient({ type: '', name: '', sortOrder: clientFields.length })
                  }
                >
                  + Add row
                </Button>
              </Group>
            </Fieldset>
          )}

          {/* Parcels */}
          <Fieldset legend="Parcels">
            <ParcelsFieldArray control={control} disabled={isReadOnly} kind={kind} />
          </Fieldset>

          {/* Email Recipients */}
          <Fieldset legend="Email Recipients">
            <Stack gap="xs">
              <Controller
                name="emailTo"
                control={control}
                render={({ field, fieldState }) => (
                  <TagsInput
                    label="To"
                    placeholder="Type an email and press Enter"
                    disabled={isReadOnly}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    splitChars={[',']}
                  />
                )}
              />
              <Controller
                name="emailCc"
                control={control}
                render={({ field, fieldState }) => (
                  <TagsInput
                    label="CC"
                    placeholder="Type an email and press Enter"
                    disabled={isReadOnly}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    splitChars={[',']}
                  />
                )}
              />
              <Controller
                name="emailBcc"
                control={control}
                render={({ field, fieldState }) => (
                  <TagsInput
                    label="BCC"
                    placeholder="Type an email and press Enter"
                    disabled={isReadOnly}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                    splitChars={[',']}
                  />
                )}
              />
              {!isReadOnly && (
                <EmailGroupPicker
                  targets={[
                    {
                      key: 'to',
                      label: 'To',
                      value: watch('emailTo') ?? [],
                      onChange: (v) =>
                        setValue('emailTo', v, { shouldDirty: true, shouldValidate: true }),
                    },
                    {
                      key: 'cc',
                      label: 'CC',
                      value: watch('emailCc') ?? [],
                      onChange: (v) => setValue('emailCc', v, { shouldDirty: true }),
                    },
                    {
                      key: 'bcc',
                      label: 'BCC',
                      value: watch('emailBcc') ?? [],
                      onChange: (v) => setValue('emailBcc', v, { shouldDirty: true }),
                    },
                  ]}
                />
              )}
            </Stack>
          </Fieldset>

          {/* Action buttons — create mode only; edit mode save button lives in the page right rail */}
          {!isReadOnly && mode === 'create' && (
            <Group justify="flex-end" mt="xs">
              <Button variant="default" onClick={() => reset()} disabled={isSubmitting}>
                Clear
              </Button>
              <Button
                variant="default"
                onClick={() =>
                  void navigate({ to: '/nominations', search: { page: 1, pageSize: 25 } })
                }
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting}>
                Create
              </Button>
            </Group>
          )}
        </Stack>
      </form>
    </>
  );
}
