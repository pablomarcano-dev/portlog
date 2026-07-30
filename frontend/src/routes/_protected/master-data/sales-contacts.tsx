import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput } from '@mantine/core';
import { SalesContactCreateSchema } from '@portlog/schemas';
import type { SalesContactCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useSalesContactsList,
  useSaveSalesContact,
  useDeleteSalesContact,
  salesContactsApi,
} from '../../../lib/api/master-data/sales-contacts';

export const Route = createFileRoute('/_protected/master-data/sales-contacts')({
  component: SalesContactsScreen,
});

/**
 * Sales Contacts — the CONDUCTOR and USUARIO named on service vouchers.
 * One flat directory feeds both fields of the Sales modal.
 */
function SalesContactsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useSalesContactsList();
  const saveSalesContact = useSaveSalesContact(selectedId);
  const deleteSalesContact = useDeleteSalesContact();

  // listQuery.data needs to be shaped as { items: ListItem[] } for the shell
  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<SalesContactCreateInput> => {
    const contact = await salesContactsApi.get(id);
    return {
      name: contact.name,
      phone: contact.phone ?? undefined,
      mobile: contact.mobile ?? undefined,
      documentNumber: contact.documentNumber ?? undefined,
      vehicle: contact.vehicle ?? undefined,
      comments: contact.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: SalesContactCreateInput) => {
      await saveSalesContact.mutateAsync(values);
    },
    [saveSalesContact],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteSalesContact.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteSalesContact],
  );

  const searchFn = useCallback(async (q: string) => {
    return salesContactsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="sales-contacts"
      schema={SalesContactCreateSchema}
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
            placeholder="e.g. J. Ramirez"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <TextInput
            label="Phone"
            placeholder="e.g. +58 281 993 5081"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
          <TextInput
            label="Mobile"
            placeholder="e.g. +58 414 085 8517"
            error={form.formState.errors.mobile?.message}
            {...form.register('mobile')}
          />
          <TextInput
            label="ID Document"
            placeholder="Cédula / national ID"
            error={form.formState.errors.documentNumber?.message}
            {...form.register('documentNumber')}
          />
          <TextInput
            label="Vehicle"
            placeholder="Unit or plate, e.g. AB123CD"
            error={form.formState.errors.vehicle?.message}
            {...form.register('vehicle')}
          />
        </Stack>
      )}
    </MasterDetailShell>
  );
}
