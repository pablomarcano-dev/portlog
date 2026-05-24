import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Alert, Stack, TextInput, Textarea } from '@mantine/core';
import { OwnerCreateSchema } from '@portlog/schemas';
import type { OwnerCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useOwners,
  useSaveOwner,
  useDeleteOwner,
  ownersApi,
} from '../../../lib/api/master-data/owners';
import { useCurrentUser } from '../../../lib/auth/queries';

export const Route = createFileRoute('/_protected/master-data/owners')({
  component: OwnersScreen,
});

function OwnersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useOwners();
  const saveOwner = useSaveOwner(selectedId);
  const deleteOwner = useDeleteOwner();
  const { data: currentUser } = useCurrentUser();

  const hasFinancialPermission = currentUser?.permissions?.includes('owner.financial') ?? false;

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((o): ListItem => ({ id: o.id, label: o.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<OwnerCreateInput> => {
    const owner = await ownersApi.get(id);
    return {
      name: owner.name,
      contactList: owner.contactList ?? undefined,
      quantity: owner.quantity ?? undefined,
      contactNumber: owner.contactNumber ?? undefined,
      physicalAddress: owner.physicalAddress ?? undefined,
      phones: owner.phones ?? undefined,
      address: owner.address ?? undefined,
      position: owner.position ?? undefined,
      socialMedia: owner.socialMedia ?? undefined,
      notes: owner.notes ?? undefined,
      birthday: owner.birthday ?? undefined,
      preferences: owner.preferences ?? undefined,
      recommendations: owner.recommendations ?? undefined,
      business: owner.business ?? undefined,
      webpage: owner.webpage ?? undefined,
      agreements: owner.agreements ?? undefined,
      historyJson: owner.historyJson
        ? (JSON.stringify(owner.historyJson, null, 2) as unknown as Record<string, unknown>)
        : undefined,
      comments: owner.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: OwnerCreateInput) => {
      await saveOwner.mutateAsync(values);
    },
    [saveOwner],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteOwner.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteOwner],
  );

  const searchFn = useCallback(async (q: string) => {
    return ownersApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="owners"
      schema={OwnerCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <OwnerFields form={form} hasFinancialPermission={hasFinancialPermission} />}
    </MasterDetailShell>
  );
}

function OwnerFields({
  form,
  hasFinancialPermission,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<OwnerCreateInput>>;
  hasFinancialPermission: boolean;
}) {
  return (
    <Stack gap="sm">
      {/* Personal block */}
      <TextInput
        label="Name"
        placeholder="e.g. Armadores del Pacífico SA"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Physical Address"
        placeholder="Physical address"
        error={form.formState.errors.physicalAddress?.message}
        {...form.register('physicalAddress')}
      />
      <TextInput
        label="Address (correspondence)"
        placeholder="Mailing address"
        error={form.formState.errors.address?.message}
        {...form.register('address')}
      />
      <TextInput
        label="Phones"
        placeholder="+1 555 0100"
        error={form.formState.errors.phones?.message}
        {...form.register('phones')}
      />
      <TextInput
        label="Contact Number"
        placeholder="Primary contact number"
        error={form.formState.errors.contactNumber?.message}
        {...form.register('contactNumber')}
      />
      <TextInput
        label="Contact List"
        placeholder="Contact list"
        error={form.formState.errors.contactList?.message}
        {...form.register('contactList')}
      />

      {/* CRM block */}
      <TextInput
        label="Birthday"
        placeholder="dd/mm/yyyy"
        error={form.formState.errors.birthday?.message}
        {...form.register('birthday')}
      />
      <Textarea
        label="Preferences"
        placeholder="Preferences and interests"
        autosize
        minRows={2}
        error={form.formState.errors.preferences?.message}
        {...form.register('preferences')}
      />
      <Textarea
        label="Recommendations"
        autosize
        minRows={2}
        error={form.formState.errors.recommendations?.message}
        {...form.register('recommendations')}
      />
      <Textarea
        label="Business"
        autosize
        minRows={2}
        error={form.formState.errors.business?.message}
        {...form.register('business')}
      />
      <TextInput
        label="Webpage"
        placeholder="https://example.com"
        error={form.formState.errors.webpage?.message}
        {...form.register('webpage')}
      />

      {/* Sensitive CRM — gated by owner.financial */}
      {hasFinancialPermission ? (
        <Textarea
          label="Agreements"
          placeholder="Financial agreements"
          autosize
          minRows={3}
          error={form.formState.errors.agreements?.message}
          {...form.register('agreements')}
        />
      ) : (
        <Alert color="yellow" title="Agreements">
          Requires owner.financial permission to view or edit.
        </Alert>
      )}

      {/* History block — gated by owner.financial */}
      {hasFinancialPermission ? (
        <Textarea
          label="History (Vessels / OTs / Invoice / Payments)"
          placeholder='{"buques": [], "ots": []}'
          autosize
          minRows={4}
          error={form.formState.errors.historyJson?.message as string | undefined}
          {...form.register('historyJson')}
        />
      ) : (
        <Alert color="yellow" title="History (Vessels / OTs / Invoice / Payments)">
          Requires owner.financial permission to view or edit.
        </Alert>
      )}

      <Textarea
        label="Notes"
        placeholder="Internal notes (legacy field)"
        autosize
        minRows={2}
        error={form.formState.errors.notes?.message}
        {...form.register('notes')}
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
