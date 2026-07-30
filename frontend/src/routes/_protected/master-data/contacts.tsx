import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Stack, TextInput, Textarea, SegmentedControl, Select, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useController, Controller } from 'react-hook-form';
import type { ControllerRenderProps } from 'react-hook-form';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
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
import { ownersApi } from '../../../lib/api/master-data/owners';

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

/**
 * A contact carries at most one cross-link, so the stored FKs tell us which
 * category the record belongs to. Without this the segmented control always
 * rendered "None" for an already-linked contact and hid its picker.
 */
function deriveCategory(fks: {
  shipperId?: string | null;
  operatorId?: string | null;
  ownerId?: string | null;
  charterId?: string | null;
}): Category {
  if (fks.shipperId) return 'shipper';
  if (fks.operatorId) return 'operator';
  if (fks.ownerId) return 'owner';
  if (fks.charterId) return 'charterer';
  return 'none';
}

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
      emails: contact.emails ?? [],
      homePhone: contact.homePhone ?? undefined,
      mobile: contact.mobile ?? undefined,
      businessPhone: contact.businessPhone ?? undefined,
      businessFax: contact.businessFax ?? undefined,
      address: contact.address ?? undefined,
      // null (not undefined) so a cleared link is sent as an explicit unset.
      shipperId: contact.shipperId ?? null,
      operatorId: contact.operatorId ?? null,
      ownerId: contact.ownerId ?? null,
      charterId: contact.charterId ?? null,
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
      {/* Keyed per record so the Link-to category never carries over from the
          previously selected contact (or from a record into "New"). */}
      {(form) => <ContactFields key={selectedId ?? 'new'} form={form} />}
    </MasterDetailShell>
  );
}

// ---------------------------------------------------------------------------
// LinkedEntitySelect — searchable picker for one of the four cross-link FKs
// ---------------------------------------------------------------------------

interface LinkedEntitySelectProps {
  entityKey: string;
  label: string;
  placeholder: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, any>;
  error?: string;
  searchFn: (q: string) => Promise<{ id: string; label: string }[]>;
  resolve: (id: string) => Promise<{ id: string; name: string }>;
}

/**
 * Searchable picker for one cross-link FK.
 *
 * Mantine renders a Select's display text by looking `value` up in `data`, so a
 * stored FK shows as blank until its option exists. The saved entity is fetched
 * by id and merged into the options, which keeps the name visible before the
 * user searches and after a search that excludes it.
 */
function LinkedEntitySelect({
  entityKey,
  label,
  placeholder,
  field,
  error,
  searchFn,
  resolve,
}: LinkedEntitySelectProps) {
  const [query, setQuery] = useState('');
  const selectedId = (field.value as string | undefined) ?? null;

  // Keyed on `query`, so a slow response for an old query can never overwrite the
  // results for the current one.
  const { data: results = [] } = useQuery({
    queryKey: [entityKey, 'search', query],
    queryFn: () =>
      searchFn(query).then((items) => items.map((r) => ({ value: r.id, label: r.label }))),
    staleTime: 30_000,
  });

  const { data: selectedOption } = useQuery({
    queryKey: [entityKey, 'resolve', selectedId],
    queryFn: () => resolve(selectedId as string).then((r) => ({ value: r.id, label: r.name })),
    enabled: selectedId != null,
    staleTime: 5 * 60_000,
  });

  const data = useMemo(() => {
    if (!selectedOption || results.some((o) => o.value === selectedOption.value)) return results;
    return [selectedOption, ...results];
  }, [results, selectedOption]);

  return (
    <Select
      label={label}
      placeholder={placeholder}
      data={data}
      value={selectedId}
      onChange={(val) => field.onChange(val ?? null)}
      onBlur={field.onBlur}
      searchable
      searchValue={query}
      onSearchChange={setQuery}
      // Mantine seeds the search box with the selected option's label when the
      // dropdown opens. Left alone, the list narrows to the option already chosen
      // and there is no way to pick a different one.
      onDropdownOpen={() => setQuery('')}
      // `results` is already filtered server-side by `query`; filtering again
      // client-side would re-apply the label seeded above.
      filter={({ options }) => options}
      // Clicking the selected option would otherwise clear the link, which reads
      // as "my choice didn't save". Unlinking goes through the clear button.
      allowDeselect={false}
      error={error}
      clearable
      nothingFoundMessage="No matches"
    />
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
  // Watch the current FK values so we can derive category on load
  const { field: shipperField } = useController({ name: 'shipperId', control: form.control });
  const { field: operatorField } = useController({ name: 'operatorId', control: form.control });
  const { field: ownerField } = useController({ name: 'ownerId', control: form.control });
  const { field: charterField } = useController({ name: 'charterId', control: form.control });

  const [category, setCategory] = useState<Category>('none');

  // Promote the category to match whatever the loaded record is linked to. Only
  // a real link wins: switching category clears the FKs, and re-deriving from
  // that empty state would snap the control straight back to "None".
  useEffect(() => {
    const derived = deriveCategory({
      shipperId: shipperField.value,
      operatorId: operatorField.value,
      ownerId: ownerField.value,
      charterId: charterField.value,
    });
    if (derived !== 'none') setCategory(derived);
  }, [shipperField.value, operatorField.value, ownerField.value, charterField.value]);

  const handleCategoryChange = (val: string) => {
    const next = val as Category;
    setCategory(next);
    // At most one cross-link may be set, so switching category drops the others.
    // null, not undefined — undefined is stripped from the PATCH body and the old
    // link would survive the save.
    shipperField.onChange(null);
    operatorField.onChange(null);
    ownerField.onChange(null);
    charterField.onChange(null);
  };

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
      <Controller
        control={form.control}
        name="emails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
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
          <LinkedEntitySelect
            entityKey="shippers"
            label="Shipper"
            placeholder="Search shippers…"
            field={shipperField}
            error={form.formState.errors.shipperId?.message}
            searchFn={shippersApi.search}
            resolve={shippersApi.get}
          />
        )}

        {category === 'operator' && (
          <LinkedEntitySelect
            entityKey="operators"
            label="Operator"
            placeholder="Search operators…"
            field={operatorField}
            error={form.formState.errors.operatorId?.message}
            searchFn={operatorsApi.search}
            resolve={operatorsApi.get}
          />
        )}

        {category === 'owner' && (
          <LinkedEntitySelect
            entityKey="owners"
            label="Owner"
            placeholder="Search owners…"
            field={ownerField}
            error={form.formState.errors.ownerId?.message}
            searchFn={ownersApi.search}
            resolve={ownersApi.get}
          />
        )}

        {category === 'charterer' && (
          <LinkedEntitySelect
            entityKey="charterers"
            label="Charterer"
            placeholder="Search charterers…"
            field={charterField}
            error={form.formState.errors.charterId?.message}
            searchFn={charterersApi.search}
            resolve={charterersApi.get}
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
