import {
  Button,
  Fieldset,
  Group,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ActionIcon,
} from '@mantine/core';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import {
  ClientCreateSchema,
  ClientEntityTypeSchema,
  ClientEmailSlotSchema,
  CLIENT_EMAIL_SLOT_LABELS,
  type ClientCreateInput,
  type ClientRecord,
} from '@portlog/schemas';
import { EmailChipsInput } from './EmailChipsInput';
import { PhoneFields, AddressFields } from './CommunicationFields';
import { allContactsOptions, allEmailGroupsOptions } from './directoryOptions';
export const EMPTY_CLIENT: ClientCreateInput = ClientCreateSchema.parse({ name: 'New client' });
EMPTY_CLIENT.name = '';
export function clientFormValues(client: ClientRecord): ClientCreateInput {
  const {
    contacts,
    emailGroups,
    name,
    entityType,
    emails,
    phones,
    addresses,
    instructions,
    notes,
    locationType,
    tariffItems,
  } = client;
  return ClientCreateSchema.parse({
    name,
    entityType,
    emails,
    phones,
    addresses,
    instructions,
    notes,
    locationType,
    tariffItems,
    contactIds: contacts.map((c) => c.id),
    emailGroups: emailGroups.map((g) => ({ slot: g.slot, emailGroupId: g.emailGroupId })),
  });
}
export function ClientFields({ form }: { form: UseFormReturn<ClientCreateInput> }) {
  const contacts = useQuery(allContactsOptions());
  const groups = useQuery(allEmailGroupsOptions());
  const {
    control,
    register,
    formState: { errors },
  } = form;
  return (
    <Stack gap="md">
      <Group grow align="flex-start">
        <TextInput
          label="Client name"
          required
          {...register('name')}
          error={errors.name?.message}
        />
        <Controller
          control={control}
          name="entityType"
          render={({ field }) => (
            <Select
              label="Entity type"
              data={ClientEntityTypeSchema.options}
              value={field.value ?? 'CLIENT'}
              onChange={field.onChange}
              allowDeselect={false}
            />
          )}
        />
        <Controller
          control={control}
          name="locationType"
          render={({ field }) => (
            <Select
              label="Location"
              clearable
              data={[
                { value: 'LOCAL', label: 'Local' },
                { value: 'EXTERIOR', label: 'Exterior' },
              ]}
              value={field.value ?? null}
              onChange={field.onChange}
            />
          )}
        />
      </Group>
      <Text size="xs" c="dimmed">
        Entity type describes the company. This client can be selected for any nomination role.
      </Text>
      <Controller
        control={control}
        name="emails"
        render={({ field, fieldState }) => (
          <EmailChipsInput
            label="Company emails"
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
            error={fieldState.error ? 'Check phone numbers and labels.' : undefined}
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
            error={
              fieldState.error
                ? 'Check addresses; each purpose must be unique and Other addresses need distinct labels.'
                : undefined
            }
          />
        )}
      />
      <Controller
        control={control}
        name="contactIds"
        render={({ field, fieldState }) => (
          <MultiSelect
            label="Contacts"
            description="People linked to this client"
            searchable
            clearable
            data={(contacts.data ?? []).map((c) => ({
              value: c.id,
              label: `${c.name}${c.emails[0] ? ` · ${c.emails[0]}` : ''}`,
            }))}
            value={field.value ?? []}
            onChange={field.onChange}
            error={fieldState.error?.message}
          />
        )}
      />
      {(contacts.isError || groups.isError) && (
        <Text c="red" size="sm">
          Could not load contacts or email groups. Refresh before changing these selections.
        </Text>
      )}
      <Fieldset legend="Message groups">
        <Controller
          control={control}
          name="emailGroups"
          render={({ field, fieldState }) => (
            <Stack gap="sm">
              <Group grow align="flex-start">
                {ClientEmailSlotSchema.options.map((slot) => (
                  <Select
                    key={slot}
                    label={CLIENT_EMAIL_SLOT_LABELS[slot]}
                    placeholder="Select group"
                    searchable
                    clearable
                    data={(groups.data ?? []).map((g) => ({
                      value: g.id,
                      label: `${g.name} (${g.memberCount})`,
                    }))}
                    value={field.value?.find((g) => g.slot === slot)?.emailGroupId ?? null}
                    onChange={(id) =>
                      field.onChange([
                        ...(field.value ?? []).filter((g) => g.slot !== slot),
                        ...(id ? [{ slot, emailGroupId: id }] : []),
                      ])
                    }
                  />
                ))}
              </Group>
              {fieldState.error && (
                <Text c="red" size="xs">
                  Check message-group selections.
                </Text>
              )}
              <Text size="xs" c="dimmed">
                These groups are available when composing nomination emails and printed in the
                instruction document.
              </Text>
            </Stack>
          )}
        />
      </Fieldset>
      <Textarea
        label="Client instructions"
        description="Standing requirements included in the nomination instruction document"
        autosize
        minRows={5}
        {...register('instructions')}
        error={errors.instructions?.message}
      />
      <Fieldset legend="Client tariff">
        <Controller
          control={control}
          name="tariffItems"
          render={({ field, fieldState }) => (
            <Stack gap="xs">
              {(field.value ?? []).map((row, i) => (
                <Group key={i} wrap="nowrap">
                  {(['item', 'amountText', 'information'] as const).map((key) => (
                    <TextInput
                      key={key}
                      aria-label={`Tariff ${i + 1} ${key}`}
                      placeholder={
                        key === 'amountText'
                          ? 'Amount / rate'
                          : key === 'item'
                            ? 'Item'
                            : 'Information'
                      }
                      value={row[key] ?? ''}
                      onChange={(e) =>
                        field.onChange(
                          field.value.map((r, j) =>
                            i === j ? { ...r, [key]: e.currentTarget.value } : r,
                          ),
                        )
                      }
                    />
                  ))}
                  <ActionIcon
                    variant="subtle"
                    color="red"
                    aria-label={`Remove tariff ${i + 1}`}
                    onClick={() =>
                      field.onChange(
                        field.value
                          .filter((_, j) => i !== j)
                          .map((row, sortOrder) => ({ ...row, sortOrder })),
                      )
                    }
                  >
                    ×
                  </ActionIcon>
                </Group>
              ))}
              {fieldState.error && (
                <Text c="red" size="xs">
                  Each tariff row needs an item.
                </Text>
              )}
              <Button
                size="xs"
                variant="light"
                onClick={() =>
                  field.onChange([
                    ...(field.value ?? []),
                    {
                      item: '',
                      amountText: '',
                      information: '',
                      sortOrder: field.value?.length ?? 0,
                    },
                  ])
                }
              >
                Add tariff item
              </Button>
            </Stack>
          )}
        />
      </Fieldset>
      <Textarea
        label="Internal notes"
        description="Not printed in client instructions"
        autosize
        minRows={2}
        {...register('notes')}
        error={errors.notes?.message}
      />
    </Stack>
  );
}
