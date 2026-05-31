import { useState, useEffect } from 'react';
import {
  ActionIcon,
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
import { NominationCreateSchema, vesselProDataSchema } from '@portlog/schemas';
import type { NominationCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { ContactNamePicker } from '../../../components/master-data/ContactNamePicker';
import { ClientNamePicker } from '../../../components/master-data/ClientNamePicker';
import { FeaturesFieldArray } from './FeaturesFieldArray';
import { NewShipParticularModal } from './NewShipParticularModal';

const NOMINATION_TYPE_OPTIONS = [
  { value: 'FULL_AGENCY', label: 'Full Agency' },
  { value: 'OWNERS_AGENTS_ONLY', label: "Owner's Agents" },
  { value: 'CHARTERERS_AGENTS_ONLY', label: "Charterer's Agents" },
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

const DEFAULT_CLIENT_TYPES = [
  'Head Owner',
  'Charterer',
  'Disponent Owner',
  'Technical Operator',
  'Commercial Operator',
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

  const defaultClients =
    mode === 'create'
      ? DEFAULT_CLIENT_TYPES.map((type, i) => ({ type, name: '', sortOrder: i }))
      : [];

  const form = useForm<NominationCreateInput>({
    resolver: zodResolver(NominationCreateSchema),
    defaultValues: {
      nominationType: 'FULL_AGENCY',
      features: [],
      nominationClients: defaultClients,
      ...defaultValues,
    },
  });

  const { register, handleSubmit, control, reset, formState, watch, setValue } = form;

  const { fields: clientFields } = useFieldArray({ control, name: 'nominationClients' });

  const shipParticularId = watch('shipParticularId');
  const opPortId = watch('opPortId') ?? null;

  // Fetch IMO for the selected vessel (needed for the vessel data fetch button)
  const shipQuery = useQuery({
    queryKey: ['ship-particulars', shipParticularId],
    queryFn: () =>
      apiRequest<{ imoNumber: string | null }>(`/master-data/ship-particulars/${shipParticularId}`),
    enabled: !!shipParticularId,
    staleTime: 60_000,
  });
  const shipImo = shipQuery.data?.imoNumber ?? null;
  const hasValidImo = !!shipImo && /^\d{7}$/.test(shipImo);

  // Ports list for name-matching when applying vessel data
  const portsQuery = useQuery({
    queryKey: ['ports-for-vessel-fetch'],
    queryFn: () =>
      apiRequest<{ items: { id: string; name: string; abbreviation: string | null }[] }>(
        '/master-data/ports?limit=200',
      ),
    staleTime: 5 * 60_000,
    enabled: hasValidImo,
  });

  const [isFetchingVessel, setIsFetchingVessel] = useState(false);

  async function handleFetchFromVessel() {
    if (!shipImo) return;
    setIsFetchingVessel(true);
    try {
      const raw = await apiRequest<unknown>(`/datalastic/vessel_pro?imo=${shipImo}`);
      const envelope = raw as { data: unknown };
      const parsed = vesselProDataSchema.safeParse(envelope?.data ?? raw);
      if (!parsed.success || parsed.data == null) {
        notifications.show({ color: 'yellow', message: 'No vessel data available for this IMO.' });
        return;
      }
      const v = parsed.data;
      const ports = portsQuery.data?.items ?? [];

      let filled = 0;
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

      notifications.show({
        color: filled > 0 ? 'green' : 'yellow',
        message:
          filled > 0
            ? `Updated ${filled} field${filled > 1 ? 's' : ''} from vessel data.`
            : 'Vessel found but no matching fields to fill.',
      });
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
  const [operatorSearch, setOperatorSearch] = useState('');
  const [charterSearch, setCharterSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [shipperSearch, setShipperSearch] = useState('');
  const [branchSearch, setBranchSearch] = useState('');
  const [opPortSearch, setOpPortSearch] = useState('');
  const [pierSearch, setPierSearch] = useState('');
  const [lastPortSearch, setLastPortSearch] = useState('');
  const [nextPortSearch, setNextPortSearch] = useState('');
  const [externalPortSearch, setExternalPortSearch] = useState('');

  // Clear pier selection whenever the operational port changes
  useEffect(() => {
    setValue('pierId', undefined);
    setPierSearch('');
  }, [opPortId, setValue]);

  function handleShipCreated(id: string) {
    setValue('shipParticularId', id, { shouldValidate: true });
    setShipSearch('');
  }

  return (
    <>
      <NewShipParticularModal
        opened={newShipModalOpen}
        onClose={() => setNewShipModalOpen(false)}
        onCreated={(id) => handleShipCreated(id)}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
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
            <Grid.Col span={4}>
              <Controller
                name="branchId"
                control={control}
                render={({ field, fieldState }) => (
                  <EntityPicker
                    endpoint="/master-data/branches"
                    label="Branch"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    searchValue={branchSearch}
                    onSearchChange={setBranchSearch}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={3}>
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
            <Grid.Col span={3}>
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
            </Grid.Col>
            <Grid.Col span={4}>
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
            </Grid.Col>
            <Grid.Col span={4}>
              <Controller
                name="externalPortId"
                control={control}
                render={({ field, fieldState }) => (
                  <EntityPicker
                    endpoint="/master-data/ports"
                    label="External Port"
                    value={field.value ?? null}
                    onChange={field.onChange}
                    searchValue={externalPortSearch}
                    onSearchChange={setExternalPortSearch}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
          </Grid>

          {/* Row 4 — Last Port / Next Port / ETA */}
          <Grid gutter="xs" align="flex-end">
            <Grid.Col span={4}>
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
            </Grid.Col>
            <Grid.Col span={4}>
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
          <Textarea
            label="Subject"
            placeholder="Email subject or notes"
            autosize
            minRows={2}
            disabled={isReadOnly}
            error={formState.errors.subject?.message}
            {...register('subject')}
          />

          {/* Parties */}
          <Fieldset legend="Parties">
            <Stack gap="xs">
              <Grid gutter="xs" align="flex-end">
                <Grid.Col span={5}>
                  <Controller
                    name="operatorId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/operators"
                        label="Operator"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={operatorSearch}
                        onSearchChange={setOperatorSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Variant"
                    placeholder="Variant"
                    disabled={isReadOnly}
                    error={formState.errors.operatorVariant?.message}
                    {...register('operatorVariant')}
                  />
                </Grid.Col>
              </Grid>
              <Grid gutter="xs" align="flex-end">
                <Grid.Col span={5}>
                  <Controller
                    name="charterId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/charterers"
                        label="Charterer"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={charterSearch}
                        onSearchChange={setCharterSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Variant"
                    placeholder="Variant"
                    disabled={isReadOnly}
                    error={formState.errors.charterVariant?.message}
                    {...register('charterVariant')}
                  />
                </Grid.Col>
              </Grid>
              <Grid gutter="xs" align="flex-end">
                <Grid.Col span={5}>
                  <Controller
                    name="ownerId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/owners"
                        label="Owner"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={ownerSearch}
                        onSearchChange={setOwnerSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Variant"
                    placeholder="Variant"
                    disabled={isReadOnly}
                    error={formState.errors.ownerVariant?.message}
                    {...register('ownerVariant')}
                  />
                </Grid.Col>
              </Grid>
              <Grid gutter="xs" align="flex-end">
                <Grid.Col span={5}>
                  <Controller
                    name="shipperId"
                    control={control}
                    render={({ field, fieldState }) => (
                      <EntityPicker
                        endpoint="/master-data/shippers"
                        label="Shipper"
                        value={field.value ?? null}
                        onChange={field.onChange}
                        searchValue={shipperSearch}
                        onSearchChange={setShipperSearch}
                        error={fieldState.error?.message}
                      />
                    )}
                  />
                </Grid.Col>
                <Grid.Col span={4}>
                  <TextInput
                    label="Variant"
                    placeholder="Variant"
                    disabled={isReadOnly}
                    error={formState.errors.shipperVariant?.message}
                    {...register('shipperVariant')}
                  />
                </Grid.Col>
              </Grid>
            </Stack>
          </Fieldset>

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
                    <Table.Th style={{ width: 120 }}>Proforma</Table.Th>
                    <Table.Th style={{ width: 160 }}>Broker</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {clientFields.map((field, index) => (
                    <Table.Tr key={field.id}>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          variant="unstyled"
                          readOnly
                          value={field.type}
                          styles={{ input: { fontWeight: 500 } }}
                        />
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
                        <TextInput
                          size="xs"
                          placeholder="Proforma"
                          {...register(`nominationClients.${index}.proforma`)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <TextInput
                          size="xs"
                          placeholder="Broker"
                          {...register(`nominationClients.${index}.broker`)}
                        />
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Fieldset>
          )}

          {/* Cargo Features */}
          <Fieldset legend="Cargo Features">
            <FeaturesFieldArray control={control} disabled={isReadOnly} />
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
            </Stack>
          </Fieldset>

          {/* Action buttons */}
          {!isReadOnly && (
            <Group justify="flex-end" mt="xs">
              {mode === 'create' ? (
                <>
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
                </>
              ) : (
                <Button type="submit" loading={isSubmitting}>
                  Save Changes
                </Button>
              )}
            </Group>
          )}
        </Stack>
      </form>
    </>
  );
}
