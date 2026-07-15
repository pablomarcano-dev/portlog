import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { CrewCreateSchema } from '@portlog/schemas';
import type { CrewCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useCrewList,
  useSaveCrew,
  useDeleteCrew,
  crewApi,
} from '../../../lib/api/master-data/crew';

export const Route = createFileRoute('/_protected/master-data/crew')({
  component: CrewScreen,
});

function CrewScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useCrewList();
  const saveCrew = useSaveCrew(selectedId);
  const deleteCrew = useDeleteCrew();

  // listQuery.data needs to be shaped as { items: ListItem[] } for the shell
  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<CrewCreateInput> => {
    const crew = await crewApi.get(id);
    return {
      name: crew.name,
      position: crew.position ?? undefined,
      documentNumber: crew.documentNumber ?? undefined,
      nationality: crew.nationality ?? undefined,
      comments: crew.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: CrewCreateInput) => {
      await saveCrew.mutateAsync(values);
    },
    [saveCrew],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteCrew.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteCrew],
  );

  const searchFn = useCallback(async (q: string) => {
    return crewApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="crew"
      schema={CrewCreateSchema}
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
            placeholder="e.g. John Smith"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextInput
            label="Position"
            placeholder="e.g. Boarding Clerk"
            error={form.formState.errors.position?.message}
            {...form.register('position')}
          />
          <TextInput
            label="Document Number"
            placeholder="e.g. passport / seaman's book number"
            error={form.formState.errors.documentNumber?.message}
            {...form.register('documentNumber')}
          />
          <TextInput
            label="Nationality"
            placeholder="e.g. Argentina"
            error={form.formState.errors.nationality?.message}
            {...form.register('nationality')}
          />
        </Stack>
      )}
    </MasterDetailShell>
  );
}
