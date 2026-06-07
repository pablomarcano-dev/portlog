import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea } from '@mantine/core';
import { BranchCreateSchema } from '@portlog/schemas';
import type { BranchCreate } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useBranches,
  useSaveBranch,
  useDeleteBranch,
  branchesApi,
} from '../../../lib/api/master-data/branches';

export const Route = createFileRoute('/_protected/master-data/branches')({
  component: BranchesScreen,
});

function BranchesScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useBranches();
  const saveBranch = useSaveBranch(selectedId);
  const deleteBranch = useDeleteBranch();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map(
            (b): ListItem => ({ id: b.id, label: `${b.code} — ${b.name}` }),
          ),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<BranchCreate> => {
    const branch = await branchesApi.get(id);
    return {
      name: branch.name,
      code: branch.code,
      comments: branch.comments ?? undefined,
      centralEmails: branch.centralEmails ?? [],
    };
  }, []);

  const onSave = useCallback(
    async (values: BranchCreate) => {
      await saveBranch.mutateAsync(values);
    },
    [saveBranch],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteBranch.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteBranch],
  );

  const searchFn = useCallback(async (q: string) => {
    return branchesApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="branches"
      schema={BranchCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <BranchFields form={form} />}
    </MasterDetailShell>
  );
}

function BranchFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<BranchCreate>>;
}) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. José Branch"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Code"
        placeholder="e.g. JSE"
        required
        error={form.formState.errors.code?.message}
        {...form.register('code')}
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
