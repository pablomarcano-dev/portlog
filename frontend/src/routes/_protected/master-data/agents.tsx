import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea } from '@mantine/core';
import { AgentCreateSchema } from '@portlog/schemas';
import type { AgentCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useAgents,
  useSaveAgent,
  useDeleteAgent,
  agentsApi,
} from '../../../lib/api/master-data/agents';

export const Route = createFileRoute('/_protected/master-data/agents')({
  component: AgentsScreen,
});

function AgentsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useAgents();
  const saveAgent = useSaveAgent(selectedId);
  const deleteAgent = useDeleteAgent();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((a): ListItem => ({ id: a.id, label: a.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<AgentCreateInput> => {
    const agent = await agentsApi.get(id);
    return {
      name: agent.name,
      address: agent.address ?? undefined,
      contactInfo: agent.contactInfo ?? undefined,
      comments: agent.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: AgentCreateInput) => {
      await saveAgent.mutateAsync(values);
    },
    [saveAgent],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteAgent.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteAgent],
  );

  const searchFn = useCallback(async (q: string) => {
    return agentsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="agents"
      schema={AgentCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <AgentFields form={form} />}
    </MasterDetailShell>
  );
}

function AgentFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<AgentCreateInput>>;
}) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Port Agents Ltd"
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
        label="Contact Info (Email / Phone / Fax)"
        placeholder="Email, phone, fax, and other contact details"
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
