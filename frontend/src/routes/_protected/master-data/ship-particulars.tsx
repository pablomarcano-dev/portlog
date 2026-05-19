import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Grid, NumberInput, Stack, Textarea, TextInput } from '@mantine/core';
import { Controller } from 'react-hook-form';
import { ShipParticularCreateSchema } from '@portlog/schemas';
import type { ShipParticularCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import {
  useShipParticulars,
  useSaveShipParticular,
  useDeleteShipParticular,
  shipParticularsApi,
} from '../../../lib/api/master-data/ship-particulars';
import { DatalasticImoLookup } from '../../../features/master-data/ship-particulars/DatalasticImoLookup';

export const Route = createFileRoute('/_protected/master-data/ship-particulars')({
  component: ShipParticularsScreen,
});

function ShipParticularsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useShipParticulars();
  const saveShipParticular = useSaveShipParticular(selectedId);
  const deleteShipParticular = useDeleteShipParticular();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((s): ListItem => ({ id: s.id, label: s.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ShipParticularCreateInput> => {
    const ship = await shipParticularsApi.get(id);
    return {
      name: ship.name,
      callSign: ship.callSign ?? undefined,
      abbreviation: ship.abbreviation ?? undefined,
      loa: ship.loa ?? undefined,
      dwt: ship.dwt ?? undefined,
      grt: ship.grt ?? undefined,
      nrt: ship.nrt ?? undefined,
      email: ship.email ?? undefined,
      imoNumber: ship.imoNumber ?? undefined,
      phone: ship.phone ?? undefined,
      phone2: ship.phone2 ?? undefined,
      fax: ship.fax ?? undefined,
      flagId: ship.flagId,
      ownerId: ship.ownerId ?? undefined,
      operatorId: ship.operatorId ?? undefined,
      comments: ship.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ShipParticularCreateInput) => {
      await saveShipParticular.mutateAsync(values);
    },
    [saveShipParticular],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteShipParticular.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteShipParticular],
  );

  const searchFn = useCallback(async (q: string) => {
    return shipParticularsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="ship-particulars"
      schema={ShipParticularCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <ShipParticularFields form={form} />}
    </MasterDetailShell>
  );
}

function ShipParticularFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<ShipParticularCreateInput>>;
}) {
  const [flagSearch, setFlagSearch] = useState('');
  const [ownerSearch, setOwnerSearch] = useState('');
  const [operatorSearch, setOperatorSearch] = useState('');

  return (
    <Stack gap="sm">
      {/* Row 1: Name + Abbreviation */}
      <Grid>
        <Grid.Col span={8}>
          <TextInput
            label="Name"
            placeholder="e.g. MV Atlantic Star"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
        </Grid.Col>
        <Grid.Col span={4}>
          <TextInput
            label="Abbreviation"
            placeholder="e.g. MVAS"
            error={form.formState.errors.abbreviation?.message}
            {...form.register('abbreviation')}
          />
        </Grid.Col>
      </Grid>

      {/* Row 2: Call Sign + IMO Number */}
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Call Sign"
            placeholder="e.g. ABCD1"
            error={form.formState.errors.callSign?.message}
            {...form.register('callSign')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="IMO Number"
            placeholder="7-digit number"
            error={form.formState.errors.imoNumber?.message}
            {...form.register('imoNumber', {
              pattern: {
                value: /^\d{7}$/,
                message: 'IMO number must be exactly 7 digits',
              },
            })}
          />
        </Grid.Col>
      </Grid>

      {/* IMO Lookup from Datalastic */}
      <DatalasticImoLookup form={form} />

      {/* Row 3: FK Pickers */}
      <Controller
        name="flagId"
        control={form.control}
        render={({ field, fieldState }) => (
          <EntityPicker
            endpoint="/master-data/flags"
            label="Flag"
            required
            value={field.value ?? null}
            onChange={(val) => field.onChange(val ?? '')}
            searchValue={flagSearch}
            onSearchChange={setFlagSearch}
            error={fieldState.error?.message}
          />
        )}
      />

      <Controller
        name="ownerId"
        control={form.control}
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

      <Controller
        name="operatorId"
        control={form.control}
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

      {/* Row 4: Tonnage fields */}
      <Grid>
        <Grid.Col span={3}>
          <Controller
            name="loa"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="LOA (m)"
                placeholder="e.g. 183.5"
                min={0}
                decimalScale={3}
                value={field.value ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : val)}
                error={fieldState.error?.message}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Controller
            name="dwt"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="DWT"
                placeholder="Deadweight Tonnage"
                min={0}
                decimalScale={3}
                value={field.value ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : val)}
                error={fieldState.error?.message}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Controller
            name="grt"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="GRT"
                placeholder="Gross Register Tonnage"
                min={0}
                decimalScale={3}
                value={field.value ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : val)}
                error={fieldState.error?.message}
              />
            )}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <Controller
            name="nrt"
            control={form.control}
            render={({ field, fieldState }) => (
              <NumberInput
                label="NRT"
                placeholder="Net Register Tonnage"
                min={0}
                decimalScale={3}
                value={field.value ?? ''}
                onChange={(val) => field.onChange(val === '' ? undefined : val)}
                error={fieldState.error?.message}
              />
            )}
          />
        </Grid.Col>
      </Grid>

      {/* Row 5: Contact info */}
      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Email"
            placeholder="vessel@operator.com"
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Phone"
            placeholder="+1 555 0100"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={6}>
          <TextInput
            label="Phone 2"
            placeholder="+1 555 0101"
            error={form.formState.errors.phone2?.message}
            {...form.register('phone2')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput
            label="Fax"
            placeholder="+1 555 0102"
            error={form.formState.errors.fax?.message}
            {...form.register('fax')}
          />
        </Grid.Col>
      </Grid>

      <Textarea
        label="Comments"
        placeholder="Internal notes"
        autosize
        minRows={2}
        error={form.formState.errors.comments?.message}
        {...form.register('comments')}
      />
    </Stack>
  );
}
