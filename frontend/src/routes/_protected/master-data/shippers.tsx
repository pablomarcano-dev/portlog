import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea, Text, Box } from '@mantine/core';
import { ShipperCreateSchema } from '@portlog/schemas';
import type { ShipperCreateInput } from '@portlog/schemas';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useShippers,
  useSaveShipper,
  useDeleteShipper,
  shippersApi,
} from '../../../lib/api/master-data/shippers';

export const Route = createFileRoute('/_protected/master-data/shippers')({
  component: ShippersScreen,
});

function ShippersScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useShippers();
  const saveShipper = useSaveShipper(selectedId);
  const deleteShipper = useDeleteShipper();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((s): ListItem => ({ id: s.id, label: s.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ShipperCreateInput> => {
    const shipper = await shippersApi.get(id);
    return {
      name: shipper.name,
      email: shipper.email ?? undefined,
      businessPhone: shipper.businessPhone ?? undefined,
      businessFax: shipper.businessFax ?? undefined,
      address: shipper.address ?? undefined,
      comments: shipper.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ShipperCreateInput) => {
      await saveShipper.mutateAsync(values);
    },
    [saveShipper],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteShipper.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteShipper],
  );

  const searchFn = useCallback(async (q: string) => {
    return shippersApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="shippers"
      schema={ShipperCreateSchema}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <ShipperFields form={form} selectedId={selectedId} />}
    </MasterDetailShell>
  );
}

function ShipperFields({
  form,
  selectedId,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<ShipperCreateInput>>;
  selectedId: string | null;
}) {
  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Acme Shipping Co"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Email"
        placeholder="e.g. contact@acmeshipping.com"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <TextInput
        label="Business Phone"
        placeholder="e.g. +1 555 0100"
        error={form.formState.errors.businessPhone?.message}
        {...form.register('businessPhone')}
      />
      <TextInput
        label="Business Fax"
        placeholder="e.g. +1 555 0101"
        error={form.formState.errors.businessFax?.message}
        {...form.register('businessFax')}
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
        label="Comments"
        placeholder="Internal notes"
        autosize
        minRows={2}
        error={form.formState.errors.comments?.message}
        {...form.register('comments')}
      />

      {/* Contact-link UI: display-only list of Contacts linked to this Shipper.
          TODO(M2-S9/POR-42): Wire real contacts query once Contacts CRUD is built.
          Contact records where Contact.shipperId === selectedId will be listed here. */}
      {selectedId !== null && (
        <Box mt="xs">
          <Text size="sm" fw={500} mb={4}>
            Linked Contacts
          </Text>
          <Text size="sm" c="dimmed">
            No contacts linked yet.
          </Text>
        </Box>
      )}
    </Stack>
  );
}
