import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { FlagCreateSchema } from '@portlog/schemas';
import type { FlagCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import { useFlags, useSaveFlag, useDeleteFlag, flagsApi } from '../../../lib/api/master-data/flags';

export const Route = createFileRoute('/_protected/master-data/flags')({
  component: FlagsScreen,
});

function FlagsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useFlags();
  const saveFlag = useSaveFlag(selectedId);
  const deleteFlag = useDeleteFlag();

  // listQuery.data needs to be shaped as { items: ListItem[] } for the shell
  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((f): ListItem => ({ id: f.id, label: f.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<FlagCreateInput> => {
    const flag = await flagsApi.get(id);
    return {
      name: flag.name,
      abbreviation: flag.abbreviation ?? undefined,
      comments: flag.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: FlagCreateInput) => {
      await saveFlag.mutateAsync(values);
    },
    [saveFlag],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteFlag.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteFlag],
  );

  const searchFn = useCallback(async (q: string) => {
    return flagsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="flags"
      schema={FlagCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => (
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Panama"
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextInput
            label="Abbreviation"
            placeholder="e.g. PA"
            error={form.formState.errors.abbreviation?.message}
            {...form.register('abbreviation')}
          />
        </Stack>
      )}
    </MasterDetailShell>
  );
}
