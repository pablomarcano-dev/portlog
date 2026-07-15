import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { ServiceCreateSchema } from '@portlog/schemas';
import type { ServiceCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useServicesList,
  useSaveService,
  useDeleteService,
  servicesApi,
} from '../../../lib/api/master-data/services';

export const Route = createFileRoute('/_protected/master-data/services')({
  component: ServicesScreen,
});

function ServicesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useServicesList();
  const saveService = useSaveService(selectedId);
  const deleteService = useDeleteService();

  // listQuery.data needs to be shaped as { items: ListItem[] } for the shell
  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((s): ListItem => ({ id: s.id, label: s.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ServiceCreateInput> => {
    const service = await servicesApi.get(id);
    return {
      name: service.name,
      comments: service.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ServiceCreateInput) => {
      await saveService.mutateAsync(values);
    },
    [saveService],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteService.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteService],
  );

  const searchFn = useCallback(async (q: string) => {
    return servicesApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="services"
      schema={ServiceCreateSchema}
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
            placeholder="e.g. Launch / Boat Service"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
        </Stack>
      )}
    </MasterDetailShell>
  );
}
