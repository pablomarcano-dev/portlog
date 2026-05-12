import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea } from '@mantine/core';
import { ChartererCreateSchema } from '@portlog/schemas';
import type { ChartererCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useCharterers,
  useSaveCharterer,
  useDeleteCharterer,
  charterersApi,
} from '../../../lib/api/master-data/charterers';

export const Route = createFileRoute('/_protected/master-data/charterers')({
  component: CharterersScreen,
});

function CharterersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useCharterers();
  const saveCharterer = useSaveCharterer(selectedId);
  const deleteCharterer = useDeleteCharterer();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ChartererCreateInput> => {
    const charterer = await charterersApi.get(id);
    return {
      name: charterer.name,
      address: charterer.address ?? undefined,
      contactInfo: charterer.contactInfo ?? undefined,
      comments: charterer.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ChartererCreateInput) => {
      await saveCharterer.mutateAsync(values);
    },
    [saveCharterer],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteCharterer.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteCharterer],
  );

  const searchFn = useCallback(async (q: string) => {
    return charterersApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="charterers"
      schema={ChartererCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <ChartererFields form={form} />}
    </MasterDetailShell>
  );
}

function ChartererFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<ChartererCreateInput>>;
}) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Acme Chartering Ltd"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <Textarea
        label="Address"
        placeholder="Full mailing address"
        autosize
        minRows={2}
        error={form.formState.errors.address?.message}
        {...form.register('address')}
      />
      <Textarea
        label="Contact Info"
        placeholder="Phone, email, and other contact details"
        autosize
        minRows={3}
        error={form.formState.errors.contactInfo?.message}
        {...form.register('contactInfo')}
      />
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
