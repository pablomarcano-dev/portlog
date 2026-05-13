import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea, SegmentedControl, Select, Text } from '@mantine/core';
import { useController } from 'react-hook-form';
import { ContactCreateSchema } from '@portlog/schemas';
import type { ContactCreateInput } from '@portlog/schemas';
import type { ZodSchema } from 'zod';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useContacts,
  useSaveContact,
  useDeleteContact,
  contactsApi,
} from '../../../lib/api/master-data/contacts';
import { shippersApi } from '../../../lib/api/master-data/shippers';
import { operatorsApi } from '../../../lib/api/master-data/operators';
import { charterersApi } from '../../../lib/api/master-data/charterers';

export const Route = createFileRoute('/_protected/master-data/contacts')({
  component: ContactsScreen,
});

// ---------------------------------------------------------------------------
// Category type for the segmented control
// ---------------------------------------------------------------------------
type Category = 'shipper' | 'operator' | 'owner' | 'charterer' | 'none';

const CATEGORY_DATA: { label: string; value: Category }[] = [
  { label: 'Shipper', value: 'shipper' },
  { label: 'Operator', value: 'operator' },
  { label: 'Owner', value: 'owner' },
  { label: 'Charterer', value: 'charterer' },
  { label: 'None', value: 'none' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

function ContactsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useContacts();
  const saveContact = useSaveContact(selectedId);
  const deleteContact = useDeleteContact();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((c): ListItem => ({ id: c.id, label: c.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<ContactCreateInput> => {
    const contact = await contactsApi.get(id);
    return {
      name: contact.name,
      email: contact.email ?? undefined,
      homePhone: contact.homePhone ?? undefined,
      mobile: contact.mobile ?? undefined,
      businessPhone: contact.businessPhone ?? undefined,
      businessFax: contact.businessFax ?? undefined,
      address: contact.address ?? undefined,
      shipperId: contact.shipperId ?? undefined,
      operatorId: contact.operatorId ?? undefined,
      ownerId: contact.ownerId ?? undefined,
      charterId: contact.charterId ?? undefined,
      comments: contact.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: ContactCreateInput) => {
      await saveContact.mutateAsync(values);
    },
    [saveContact],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteContact.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteContact],
  );

  // FlashSearch wired to name + email (both fields searched server-side via ?q=)
  const searchFn = useCallback(async (q: string) => {
    return contactsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="contacts"
      schema={ContactCreateSchema as ZodSchema<ContactCreateInput>}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <ContactFields form={form} />}
    </MasterDetailShell>
  );
}

// ---------------------------------------------------------------------------
// Form fields — extracted so hooks run at component level
// ---------------------------------------------------------------------------

function ContactFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<ContactCreateInput>>;
}) {
  // Local UI state for which category is selected
  const [category, setCategory] = useState<Category>('none');

  // Watch the current FK values so we can derive category on load
  const { field: shipperField } = useController({ name: 'shipperId', control: form.control });
  const { field: operatorField } = useController({ name: 'operatorId', control: form.control });
  const { field: ownerField } = useController({ name: 'ownerId', control: form.control });
  const { field: charterField } = useController({ name: 'charterId', control: form.control });

  // ---------------------------------------------------------------------------
  // Picker data — loaded lazily via search endpoints
  // ---------------------------------------------------------------------------
  const [shipperOptions, setShipperOptions] = useState<{ value: string; label: string }[]>([]);
  const [operatorOptions, setOperatorOptions] = useState<{ value: string; label: string }[]>([]);
  const [chartererOptions, setChartererOptions] = useState<{ value: string; label: string }[]>([]);

  const handleCategoryChange = (val: string) => {
    const next = val as Category;
    setCategory(next);
    // Clear all FK fields when switching category
    shipperField.onChange(undefined);
    operatorField.onChange(undefined);
    ownerField.onChange(undefined);
    charterField.onChange(undefined);
  };

  // Load picker options on mount for each category
  const loadShippers = useCallback(async (q: string) => {
    const results = await shippersApi.search(q);
    setShipperOptions(results.map((r) => ({ value: r.id, label: r.label })));
  }, []);

  const loadOperators = useCallback(async (q: string) => {
    const results = await operatorsApi.search(q);
    setOperatorOptions(results.map((r) => ({ value: r.id, label: r.label })));
  }, []);

  const loadCharterers = useCallback(async (q: string) => {
    const results = await charterersApi.search(q);
    setChartererOptions(results.map((r) => ({ value: r.id, label: r.label })));
  }, []);

  return (
    <Stack gap="sm">
      {/* Standard contact fields */}
      <TextInput
        label="Name"
        placeholder="e.g. Jane Doe"
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Email"
        placeholder="e.g. jane@example.com"
        error={form.formState.errors.email?.message}
        {...form.register('email')}
      />
      <TextInput
        label="Home Phone"
        placeholder="e.g. +1 555 0100"
        error={form.formState.errors.homePhone?.message}
        {...form.register('homePhone')}
      />
      <TextInput
        label="Mobile"
        placeholder="e.g. +1 555 0200"
        error={form.formState.errors.mobile?.message}
        {...form.register('mobile')}
      />
      <TextInput
        label="Business Phone"
        placeholder="e.g. +1 555 0300"
        error={form.formState.errors.businessPhone?.message}
        {...form.register('businessPhone')}
      />
      <TextInput
        label="Business Fax"
        placeholder="e.g. +1 555 0301"
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

      {/* Category segmented control + conditional entity picker */}
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Link to
        </Text>
        <SegmentedControl
          value={category}
          onChange={handleCategoryChange}
          data={CATEGORY_DATA}
          fullWidth
        />

        {category === 'shipper' && (
          <Select
            label="Shipper"
            placeholder="Search shippers…"
            data={shipperOptions}
            value={shipperField.value ?? null}
            onChange={(val) => shipperField.onChange(val ?? undefined)}
            onBlur={shipperField.onBlur}
            searchable
            onSearchChange={(q) => {
              void loadShippers(q);
            }}
            error={form.formState.errors.shipperId?.message}
            clearable
          />
        )}

        {category === 'operator' && (
          <Select
            label="Operator"
            placeholder="Search operators…"
            data={operatorOptions}
            value={operatorField.value ?? null}
            onChange={(val) => operatorField.onChange(val ?? undefined)}
            onBlur={operatorField.onBlur}
            searchable
            onSearchChange={(q) => {
              void loadOperators(q);
            }}
            error={form.formState.errors.operatorId?.message}
            clearable
          />
        )}

        {category === 'owner' && (
          // TODO: blocked-by POR-39 Owner — render empty picker until Owner entity is built
          <Select
            label="Owner"
            placeholder="Owner picker — available once POR-39 lands"
            data={[]}
            value={ownerField.value ?? null}
            onChange={(val) => ownerField.onChange(val ?? undefined)}
            onBlur={ownerField.onBlur}
            disabled
            error={form.formState.errors.ownerId?.message}
          />
        )}

        {category === 'charterer' && (
          <Select
            label="Charterer"
            placeholder="Search charterers…"
            data={chartererOptions}
            value={charterField.value ?? null}
            onChange={(val) => charterField.onChange(val ?? undefined)}
            onBlur={charterField.onBlur}
            searchable
            onSearchChange={(q) => {
              void loadCharterers(q);
            }}
            error={form.formState.errors.charterId?.message}
            clearable
          />
        )}
      </Stack>

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
