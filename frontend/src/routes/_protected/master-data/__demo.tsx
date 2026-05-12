import { createFileRoute, redirect } from '@tanstack/react-router';
import { useState } from 'react';
import { Stack, Title, TextInput, Text } from '@mantine/core';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';

export const Route = createFileRoute('/_protected/master-data/__demo')({
  beforeLoad() {
    // This route is only available in development builds.
    if (!import.meta.env.DEV) {
      throw redirect({ to: '/' });
    }
  },
  component: MasterDataDemoPage,
});

// ---------------------------------------------------------------------------
// In-memory demo dataset — no backend dependency
// ---------------------------------------------------------------------------

const DEMO_RECORDS: Record<string, DemoForm> = {
  '1': { name: 'Alpha', code: 'AL', comments: 'First demo record' },
  '2': { name: 'Bravo', code: 'BR', comments: null },
  '3': { name: 'Charlie', code: 'CH', comments: 'Third demo record' },
};

const DemoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  code: z.string().min(1, 'Code is required').max(10),
  comments: z.string().max(1000).nullable().optional(),
});

type DemoForm = z.infer<typeof DemoSchema>;

async function demoLoadById(id: string): Promise<DemoForm> {
  await new Promise((r) => setTimeout(r, 50)); // simulate network
  const record = DEMO_RECORDS[id];
  if (!record) throw new Error(`Record ${id} not found`);
  return record;
}

async function demoSave(values: DemoForm): Promise<void> {
  await new Promise((r) => setTimeout(r, 80));
  // eslint-disable-next-line no-console
  console.log('[demo] save', values);
}

async function demoDelete(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 80));
  // eslint-disable-next-line no-console
  console.log('[demo] delete', id);
}

async function demoSearch(query: string): Promise<Array<{ id: string; label: string }>> {
  await new Promise((r) => setTimeout(r, 50));
  const q = query.toLowerCase();
  return Object.entries(DEMO_RECORDS)
    .filter(([, v]) => v.name.toLowerCase().includes(q) || v.code.toLowerCase().includes(q))
    .map(([id, v]) => ({ id, label: `${v.name} (${v.code})` }));
}

// ---------------------------------------------------------------------------
// Demo page component
// ---------------------------------------------------------------------------

function MasterDataDemoPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['demo', 'list'],
    queryFn: async (): Promise<{ items: ListItem[] }> => {
      await new Promise((r) => setTimeout(r, 30));
      return {
        items: Object.entries(DEMO_RECORDS).map(([id, v]) => ({
          id,
          label: `${v.name} (${v.code})`,
        })),
      };
    },
    staleTime: Infinity,
  });

  return (
    <Stack gap="md" h="100%">
      <Title order={3} px="md" pt="md">
        MasterDetailShell — Dev Demo
      </Title>
      <Text size="sm" c="dimmed" px="md">
        In-memory dataset. Open browser console to see save/delete callbacks. Delete button only
        visible when logged in as ADM.
      </Text>

      <MasterDetailShell
        entityKey="demo"
        schema={DemoSchema}
        listQuery={listQuery}
        selectedId={selectedId}
        onSelect={setSelectedId}
        loadById={demoLoadById}
        onSave={demoSave}
        onDelete={demoDelete}
        searchFn={demoSearch}
      >
        {(form) => (
          <Stack gap="sm">
            <TextInput
              label="Name"
              error={form.formState.errors.name?.message}
              {...form.register('name')}
            />
            <TextInput
              label="Code"
              error={form.formState.errors.code?.message}
              {...form.register('code')}
            />
          </Stack>
        )}
      </MasterDetailShell>
    </Stack>
  );
}
