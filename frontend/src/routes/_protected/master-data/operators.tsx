import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback } from 'react';
import { Stack, TextInput, Textarea, Checkbox, Select, Button, Tooltip, Text } from '@mantine/core';
import { useController } from 'react-hook-form';
import { OperatorCreateSchema } from '@portlog/schemas';
import type { OperatorCreateInput } from '@portlog/schemas';
import type { ZodSchema } from 'zod';
import { MasterDetailShell } from '../../../components/master-data/MasterDetailShell';
import type { ListItem } from '../../../components/master-data/MasterDetailShell';
import {
  useOperators,
  useSaveOperator,
  useDeleteOperator,
  operatorsApi,
} from '../../../lib/api/master-data/operators';

export const Route = createFileRoute('/_protected/master-data/operators')({
  component: OperatorsScreen,
});

const LOCATION_OPTIONS = [
  { value: 'L', label: 'L — Local' },
  { value: 'E', label: 'E — Exterior' },
];

function OperatorsScreen() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const listQuery = useOperators();
  const saveOperator = useSaveOperator(selectedId);
  const deleteOperator = useDeleteOperator();

  const shellListQuery = {
    ...listQuery,
    data: listQuery.data
      ? {
          items: listQuery.data.items.map((o): ListItem => ({ id: o.id, label: o.name })),
        }
      : undefined,
  } as Parameters<typeof MasterDetailShell>[0]['listQuery'];

  const loadById = useCallback(async (id: string): Promise<OperatorCreateInput> => {
    const operator = await operatorsApi.get(id);
    return {
      name: operator.name,
      email: operator.email ?? undefined,
      businessPhone: operator.businessPhone ?? undefined,
      businessFax: operator.businessFax ?? undefined,
      address: operator.address ?? undefined,
      standardRequirements: operator.standardRequirements ?? undefined,
      sendCopy: operator.sendCopy ?? false,
      location: (operator.location as 'L' | 'E' | undefined) ?? undefined,
      comments: operator.comments ?? undefined,
    };
  }, []);

  const onSave = useCallback(
    async (values: OperatorCreateInput) => {
      await saveOperator.mutateAsync(values);
    },
    [saveOperator],
  );

  const onDelete = useCallback(
    async (id: string) => {
      await deleteOperator.mutateAsync(id);
      setSelectedId(null);
    },
    [deleteOperator],
  );

  const searchFn = useCallback(async (q: string) => {
    return operatorsApi.search(q);
  }, []);

  return (
    <MasterDetailShell
      entityKey="operators"
      schema={OperatorCreateSchema as ZodSchema<OperatorCreateInput>}
      listQuery={shellListQuery}
      selectedId={selectedId}
      onSelect={setSelectedId}
      loadById={loadById}
      onSave={onSave}
      onDelete={onDelete}
      searchFn={searchFn}
    >
      {(form) => <OperatorFields form={form} />}
    </MasterDetailShell>
  );
}

/**
 * Extracted so useController (which needs FormProvider context) can call
 * hooks at component level without conditional hook rules issues.
 */
function OperatorFields({
  form,
}: {
  form: ReturnType<typeof import('react-hook-form').useForm<OperatorCreateInput>>;
}) {
  const { field: locationField, fieldState: locationState } = useController({
    name: 'location',
    control: form.control,
  });

  const { field: sendCopyField } = useController({
    name: 'sendCopy',
    control: form.control,
  });

  return (
    <Stack gap="sm">
      <TextInput
        label="Name"
        placeholder="e.g. Pacific Operators Inc."
        required
        error={form.formState.errors.name?.message}
        {...form.register('name')}
      />
      <TextInput
        label="Email"
        placeholder="e.g. ops@company.com"
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
        label="Standard Requirements"
        placeholder="Enter standard requirements for this operator"
        autosize
        minRows={3}
        error={form.formState.errors.standardRequirements?.message}
        {...form.register('standardRequirements')}
      />
      <Checkbox
        label="Send Copy"
        checked={sendCopyField.value ?? false}
        onChange={(e) => sendCopyField.onChange(e.currentTarget.checked)}
        onBlur={sendCopyField.onBlur}
        ref={sendCopyField.ref}
      />
      <Select
        label="Location"
        placeholder="Select location type"
        data={LOCATION_OPTIONS}
        value={locationField.value ?? null}
        onChange={(value) => locationField.onChange((value as 'L' | 'E' | null) ?? undefined)}
        onBlur={locationField.onBlur}
        error={locationState.error?.message}
        clearable
      />
      <Tooltip label="Coming in PDA / M6" position="right">
        <Button variant="light" disabled style={{ width: 'fit-content' }}>
          Items Proforma
        </Button>
      </Tooltip>

      {/* Multi-select Contacts — blocked pending POR-38 Contacts CRUD */}
      {/* TODO: blocked-by POR-38 Contacts — replace this placeholder with a real MultiSelect once
          the Contacts entity and /master-data/contacts endpoint are implemented. */}
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Contacts
        </Text>
        <Text size="xs" c="dimmed">
          Contact linking will be available once Contacts (POR-38) is implemented.
        </Text>
      </Stack>
    </Stack>
  );
}
