import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { MultiSelect, Stack, TextInput, Textarea } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { ContactCreateSchema, type ContactCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import { PhoneFields, AddressFields } from '../../../components/master-data/CommunicationFields';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import {
  allClientsOptions,
  allContactsOptions,
} from '../../../components/master-data/directoryOptions';
import {
  contactsApi,
  useSaveContact,
  useDeleteContact,
} from '../../../lib/api/master-data/contacts';
const EMPTY: ContactCreateInput = {
  name: '',
  emails: [],
  phones: [],
  addresses: [],
  clientIds: [],
  ownerId: null,
  notes: null,
};
export const Route = createFileRoute('/_protected/master-data/contacts')({
  component: ContactsScreen,
});
function ContactsScreen() {
  const [id, setId] = useState<string | null>(null);
  const list = useQuery({
    ...allContactsOptions(),
    select: (rows) => ({ items: rows.map((r) => ({ id: r.id, label: r.name })) }),
  });
  const save = useSaveContact(id);
  const remove = useDeleteContact();
  const load = useCallback(async (id: string) => {
    const { clients, name, emails, phones, addresses, notes, ownerId } = await contactsApi.get(id);
    return ContactCreateSchema.parse({
      name,
      emails,
      phones,
      addresses,
      notes,
      ownerId,
      clientIds: clients.map((c) => c.id),
    });
  }, []);
  return (
    <MasterDetailShell<ContactCreateInput>
      entityKey="contacts"
      schema={ContactCreateSchema}
      newValues={EMPTY}
      showComments={false}
      listQuery={list}
      selectedId={id}
      onSelect={setId}
      loadById={load}
      searchFn={contactsApi.search}
      onSave={async (values) => {
        const row = await save.mutateAsync(values);
        setId(row.id);
      }}
      onDelete={async (id) => {
        await remove.mutateAsync(id);
        setId(null);
      }}
    >
      {(form) => <ContactFields form={form} />}
    </MasterDetailShell>
  );
}
function ContactFields({ form }: { form: UseFormReturn<ContactCreateInput> }) {
  const clients = useQuery(allClientsOptions());
  const [ownerSearch, setOwnerSearch] = useState('');
  const {
    control,
    register,
    formState: { errors },
  } = form;
  return (
    <Stack gap="md">
      <TextInput label="Contact name" required {...register('name')} error={errors.name?.message} />
      <Controller
        control={control}
        name="emails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="phones"
        render={({ field, fieldState }) => (
          <PhoneFields
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error ? 'Check phone entries.' : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="addresses"
        render={({ field, fieldState }) => (
          <AddressFields
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error ? 'Check address purposes and labels.' : undefined}
          />
        )}
      />
      <Controller
        control={control}
        name="clientIds"
        render={({ field, fieldState }) => (
          <MultiSelect
            label="Clients"
            description="This person can be associated with multiple clients"
            searchable
            clearable
            data={(clients.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.name} · ${c.entityType.toLowerCase()}`,
            }))}
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="ownerId"
        render={({ field }) => (
          <EntityPicker
            endpoint="/master-data/owners"
            label="Owner (optional)"
            value={field.value ?? null}
            onChange={field.onChange}
            searchValue={ownerSearch}
            onSearchChange={setOwnerSearch}
          />
        )}
      />
      <Textarea label="Internal notes" {...register('notes')} autosize minRows={3} />
    </Stack>
  );
}
