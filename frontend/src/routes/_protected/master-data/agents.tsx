import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Alert, Select, Stack, TextInput, Textarea } from '@mantine/core';
import { Controller } from 'react-hook-form';
import { AgentCreateSchema } from '@portlog/schemas';
import type { AgentCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import {
  useAgents,
  useAgentNominationConfigurationHealth,
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
  const configurationHealthQuery = useAgentNominationConfigurationHealth();
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
      // Keep clearable text inputs controlled; the shared schema converts this blank to null.
      mobile: agent.mobile ?? '',
      branchId: agent.branchId ?? null,
      operationalRole: agent.operationalRole ?? null,
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
      {(form) => <AgentFields form={form} configurationHealth={configurationHealthQuery.data} />}
    </MasterDetailShell>
  );
}

function AgentFields({
  form,
  configurationHealth,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<AgentCreateInput>>;
  configurationHealth?: {
    total: number;
    availableForNominations: number;
    unavailableForNominations: number;
    partiallyConfigured: number;
    unassigned: number;
  };
}) {
  const [branchSearch, setBranchSearch] = useState('');
  const showConfigurationWarning =
    configurationHealth !== undefined &&
    (configurationHealth.partiallyConfigured > 0 ||
      (configurationHealth.total > 0 && configurationHealth.availableForNominations === 0));

  return (
    <Stack gap="sm">
      {showConfigurationWarning && (
        <Alert
          color="yellow"
          title={
            configurationHealth.availableForNominations === 0
              ? 'No nomination agents configured'
              : 'Incomplete nomination agent setup'
          }
        >
          {configurationHealth.availableForNominations === 0
            ? `None of the ${configurationHealth.total} agent records can currently feed M.I.C. or Boarding.`
            : `${configurationHealth.partiallyConfigured} agent records have only a Branch or an Operational role.`}{' '}
          Assign both fields only to agency staff who should appear in nominations; external port
          agencies can remain unassigned.
          {configurationHealth.availableForNominations === 0 &&
          configurationHealth.partiallyConfigured > 0
            ? ` ${configurationHealth.partiallyConfigured} records are partially configured.`
            : ''}
        </Alert>
      )}
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
      <TextInput
        label="Mobile"
        placeholder="e.g. +58 424 000 0000"
        error={form.formState.errors.mobile?.message}
        {...form.register('mobile')}
      />
      <Controller
        name="branchId"
        control={form.control}
        render={({ field, fieldState }) => (
          <EntityPicker
            endpoint="/master-data/branches"
            label="Branch"
            value={field.value ?? null}
            onChange={(value) => field.onChange(value ?? null)}
            searchValue={branchSearch}
            onSearchChange={setBranchSearch}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        name="operationalRole"
        control={form.control}
        render={({ field, fieldState }) => (
          <Select
            label="Operational role"
            description="Managers and supervisors appear in M.I.C.; shipping agents appear in Boarding."
            placeholder="Select role"
            clearable
            value={field.value ?? null}
            onChange={field.onChange}
            data={[
              { value: 'BRANCH_MANAGER', label: 'Branch manager' },
              { value: 'SUPERVISOR', label: 'Supervisor' },
              { value: 'SHIPPING_AGENT', label: 'Shipping agent' },
            ]}
            error={fieldState.error?.message}
          />
        )}
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
