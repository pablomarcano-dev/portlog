import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Divider, Stack, Tabs, TextInput, Textarea } from '@mantine/core';
import { Controller } from 'react-hook-form';
import { BranchCreateSchema } from '@portlog/schemas';
import type { BranchCreate } from '@portlog/schemas';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useBranches,
  useSaveBranch,
  useDeleteBranch,
  branchesApi,
} from '../../../lib/api/master-data/branches';
import { BranchDocumentTemplateAdminPanel } from '../../../features/branch-documents/components/admin/BranchDocumentTemplateAdminPanel';

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
      emails: branch.emails ?? [],
      address: branch.address ?? undefined,
      phone: branch.phone ?? undefined,
      fax: branch.fax ?? undefined,
      mobile24h: branch.mobile24h ?? undefined,
      coverage: branch.coverage ?? undefined,
      contactName: branch.contactName ?? undefined,
      contactTitle: branch.contactTitle ?? undefined,
      contactMobile: branch.contactMobile ?? undefined,
      contactEmails: branch.contactEmails ?? [],
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
      {(form) => (
        <Tabs defaultValue="info">
          <Tabs.List mb="md">
            <Tabs.Tab value="info">Branch Info</Tabs.Tab>
            {selectedId && <Tabs.Tab value="templates">Document Templates</Tabs.Tab>}
          </Tabs.List>
          <Tabs.Panel value="info">
            <BranchFields form={form} />
          </Tabs.Panel>
          {selectedId && (
            <Tabs.Panel value="templates">
              <BranchDocumentTemplateAdminPanel branchId={selectedId} />
            </Tabs.Panel>
          )}
        </Tabs>
      )}
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

      {/* These three lists decide who is copied on every notice sent for this
          branch's nominations, so each says where it lands rather than leaving
          the agent to discover it by sending. */}
      <Divider label="Email Distribution" labelPosition="left" mt="xs" />
      <Controller
        control={form.control}
        name="emails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            label="Branch Emails"
            description="The branch's operational addresses. Copied (CC) on notices for this branch, and shown as the contact address in the email signature."
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="centralEmails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            label="Central / Supervisory Emails"
            description="Head-office oversight. Blind-copied (BCC) on notices for this branch, so counterparties do not see them."
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={form.control}
        name="contactEmails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            label="Contact Person Emails"
            description="The named contact below. Used in documents, not added to outgoing recipients."
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />

      <Divider label="Contact Details" labelPosition="left" mt="xs" />
      <TextInput
        label="Contact Name"
        placeholder="e.g. Ms. Cindy Moreno"
        error={form.formState.errors.contactName?.message}
        {...form.register('contactName')}
      />
      <TextInput
        label="Contact Title"
        placeholder="e.g. Branch Manager"
        error={form.formState.errors.contactTitle?.message}
        {...form.register('contactTitle')}
      />
      <TextInput
        label="Contact Mobile"
        placeholder="e.g. +58 414 7883108"
        error={form.formState.errors.contactMobile?.message}
        {...form.register('contactMobile')}
      />

      <Divider label="Office Details" labelPosition="left" mt="xs" />
      <TextInput
        label="Phone"
        placeholder="e.g. +58 281 2811100"
        error={form.formState.errors.phone?.message}
        {...form.register('phone')}
      />
      <TextInput
        label="Fax"
        placeholder="e.g. +58 281 2811101"
        error={form.formState.errors.fax?.message}
        {...form.register('fax')}
      />
      <TextInput
        label="24h Mobile"
        placeholder="e.g. +58 414 7883108 / +58 424 8221100"
        error={form.formState.errors.mobile24h?.message}
        {...form.register('mobile24h')}
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
        label="Coverage"
        placeholder="Ports and terminals attended by this branch"
        autosize
        minRows={2}
        error={form.formState.errors.coverage?.message}
        {...form.register('coverage')}
      />
    </Stack>
  );
}
