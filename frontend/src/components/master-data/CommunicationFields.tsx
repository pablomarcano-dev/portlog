import {
  Button,
  Fieldset,
  Group,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  ActionIcon,
} from '@mantine/core';
import {
  PhoneKindSchema,
  AddressPurposeSchema,
  type PhoneEntry,
  type AddressEntry,
} from '@portlog/schemas';

export function PhoneFields({
  value,
  onChange,
  error,
}: {
  value: PhoneEntry[];
  onChange: (v: PhoneEntry[]) => void;
  error?: string;
}) {
  const update = (index: number, patch: Partial<PhoneEntry>) =>
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  return (
    <Fieldset legend="Phone numbers">
      <Stack gap="xs">
        {value.map((phone, i) => (
          <Group key={i} align="flex-start" wrap="nowrap">
            <Select
              aria-label={`Phone ${i + 1} kind`}
              w={140}
              allowDeselect={false}
              data={PhoneKindSchema.options}
              value={phone.kind}
              onChange={(v) => update(i, { kind: PhoneKindSchema.parse(v) })}
            />
            <TextInput
              aria-label={`Phone ${i + 1} number`}
              placeholder="Number, including country code"
              style={{ flex: 1 }}
              value={phone.number}
              onChange={(e) => update(i, { number: e.currentTarget.value })}
            />
            <TextInput
              aria-label={`Phone ${i + 1} label`}
              placeholder="Label"
              w={140}
              value={phone.label ?? ''}
              onChange={(e) => update(i, { label: e.currentTarget.value })}
            />
            <ActionIcon
              variant="subtle"
              aria-label={`Move phone ${i + 1} up`}
              disabled={i === 0}
              onClick={() => {
                const next = [...value];
                [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                onChange(next.map((p, sortOrder) => ({ ...p, sortOrder })));
              }}
            >
              ↑
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Remove phone ${i + 1}`}
              onClick={() =>
                onChange(
                  value.filter((_, j) => j !== i).map((row, sortOrder) => ({ ...row, sortOrder })),
                )
              }
            >
              ×
            </ActionIcon>
          </Group>
        ))}
        {error && (
          <Text c="red" size="xs">
            {error}
          </Text>
        )}
        <Button
          variant="light"
          size="xs"
          onClick={() =>
            onChange([...value, { kind: 'BUSINESS', number: '', sortOrder: value.length }])
          }
        >
          Add phone number
        </Button>
      </Stack>
    </Fieldset>
  );
}
export function AddressFields({
  value,
  onChange,
  error,
}: {
  value: AddressEntry[];
  onChange: (v: AddressEntry[]) => void;
  error?: string;
}) {
  const update = (index: number, patch: Partial<AddressEntry>) =>
    onChange(value.map((v, i) => (i === index ? { ...v, ...patch } : v)));
  return (
    <Fieldset legend="Addresses">
      <Stack gap="xs">
        {value.map((address, i) => (
          <Group key={i} align="flex-start" wrap="nowrap">
            <Stack gap="xs" w={140}>
              <Select
                aria-label={`Address ${i + 1} purpose`}
                allowDeselect={false}
                data={AddressPurposeSchema.options}
                value={address.purpose}
                onChange={(v) => update(i, { purpose: AddressPurposeSchema.parse(v) })}
              />
              <TextInput
                aria-label={`Address ${i + 1} label`}
                placeholder="Label"
                value={address.label ?? ''}
                onChange={(e) => update(i, { label: e.currentTarget.value })}
              />
            </Stack>
            <Textarea
              aria-label={`Address ${i + 1} text`}
              placeholder="Full address"
              minRows={3}
              autosize
              style={{ flex: 1 }}
              value={address.text}
              onChange={(e) => update(i, { text: e.currentTarget.value })}
            />
            <ActionIcon
              variant="subtle"
              aria-label={`Move address ${i + 1} up`}
              disabled={i === 0}
              onClick={() => {
                const next = [...value];
                [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                onChange(next.map((a, sortOrder) => ({ ...a, sortOrder })));
              }}
            >
              ↑
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              color="red"
              aria-label={`Remove address ${i + 1}`}
              onClick={() =>
                onChange(
                  value.filter((_, j) => j !== i).map((row, sortOrder) => ({ ...row, sortOrder })),
                )
              }
            >
              ×
            </ActionIcon>
          </Group>
        ))}
        {error && (
          <Text c="red" size="xs">
            {error}
          </Text>
        )}
        <Button
          variant="light"
          size="xs"
          onClick={() =>
            onChange([
              ...value,
              {
                purpose:
                  AddressPurposeSchema.options.find((p) => !value.some((a) => a.purpose === p)) ??
                  'OTHER',
                text: '',
                sortOrder: value.length,
              },
            ])
          }
        >
          Add address
        </Button>
      </Stack>
    </Fieldset>
  );
}
