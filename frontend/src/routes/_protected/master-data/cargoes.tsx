import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Select } from '@mantine/core';
import { useController } from 'react-hook-form';
import { CargoCreateSchema } from '@portlog/schemas';
import type { CargoCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useCargoes,
  useSaveCargo,
  useDeleteCargo,
  cargoesApi,
} from '../../../lib/api/master-data/cargoes';

export const Route = createFileRoute('/_protected/master-data/cargoes')({
  component: CargoesScreen,
});

/**
 * BBL unit options.
 * TODO: confirm final list with client — open question per POR-32 acceptance criteria.
 * Expected values are BBL, MT, KG, LT. Using permissive string in schema until confirmed.
 */
const BBL_UNIT_OPTIONS = [
  { value: 'BBL', label: 'BBL — Barrels' },
  { value: 'MT', label: 'MT — Metric Tons' },
  { value: 'KG', label: 'KG — Kilograms' },
  { value: 'LT', label: 'LT — Long Tons' },
];

function CargoesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useCargoes();
  const saveCargo = useSaveCargo(selectedId);
  const deleteCargo = useDeleteCargo();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<CargoCreateInput> => {
    const cargo = await cargoesApi.get(id);
    return {
      name: cargo.name,
      bblUnit: cargo.bblUnit,
      comments: cargo.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: CargoCreateInput) => {
      await saveCargo.mutateAsync(values);
    },
    [saveCargo],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteCargo.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteCargo],
  );

  const searchFn = useCallback(async (q: string) => {
    return cargoesApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="cargoes"
      schema={CargoCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <CargoFields form={form} />}
    </MasterDetailShell>
  );
}

/**
 * Extracted so useController (which needs FormProvider context) can call
 * the hook at component level without conditional hook rules issues.
 */
function CargoFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<CargoCreateInput>>;
}) {
  const { field: bblUnitField, fieldState: bblUnitState } = useController({
    name: 'bblUnit',
    control: form.control,
  });

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Crude Oil"
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <Select
        label="BBL Unit"
        placeholder="Select unit"
        data={BBL_UNIT_OPTIONS}
        value={bblUnitField.value ?? null}
        onChange={(value) => bblUnitField.onChange(value ?? '')}
        onBlur={bblUnitField.onBlur}
        error={bblUnitState.error?.message}
        required
      />
    </Stack>
  );
}
