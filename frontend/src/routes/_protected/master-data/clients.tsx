import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Select, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  ClientCreateSchema,
  ClientEntityTypeSchema,
  type ClientCreateInput,
} from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import {
  ClientFields,
  EMPTY_CLIENT,
  clientFormValues,
} from '../../../components/master-data/ClientFields';
import { allClientsOptions } from '../../../components/master-data/directoryOptions';
import { clientsApi, useSaveClient, useDeleteClient } from '../../../lib/api/master-data/clients';
export const Route = createFileRoute('/_protected/master-data/clients')({
  component: ClientsScreen,
});
function ClientsScreen() {
  const [id, setId] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const list = useQuery({
    ...allClientsOptions(),
    select: (rows) => ({
      items: rows
        .filter((r) => !type || r.entityType === type)
        .map((r) => ({ id: r.id, label: `${r.name} · ${r.entityType.toLowerCase()}` })),
    }),
  });
  const save = useSaveClient(id);
  const remove = useDeleteClient();
  const loadById = useCallback(
    async (id: string) => clientFormValues(await clientsApi.get(id)),
    [],
  );
  return (
    <Stack h="100%" gap="xs">
      <Select
        mx="md"
        mt="sm"
        label="Filter entity type"
        placeholder="All clients"
        clearable
        data={ClientEntityTypeSchema.options}
        value={type}
        onChange={setType}
      />
      <div style={{ flex: 1, minHeight: 0 }}>
        <MasterDetailShell<ClientCreateInput>
          entityKey="clients"
          showComments={false}
          newValues={EMPTY_CLIENT}
          schema={ClientCreateSchema}
          listQuery={list}
          selectedId={id}
          onSelect={setId}
          loadById={loadById}
          onSave={async (values) => {
            const row = await save.mutateAsync(values);
            setId(row.id);
          }}
          onDelete={async (id) => {
            await remove.mutateAsync(id);
            setId(null);
          }}
          searchFn={clientsApi.search}
        >
          {(form) => <ClientFields form={form} />}
        </MasterDetailShell>
      </div>
    </Stack>
  );
}
