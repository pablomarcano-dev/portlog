import { useFieldArray, Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Button, Group, NumberInput, Select, Stack, Text, TextInput } from '@mantine/core';
import type { NominationCreateInput } from '@portlog/schemas';
import { CargoNamePicker } from './CargoNamePicker';

const OPERATION_OPTIONS = [
  { value: 'Disch', label: 'Disch' },
  { value: 'Load', label: 'Load' },
  { value: 'Transit', label: 'Transit' },
  { value: 'STSD', label: 'STSD' },
  { value: 'STSL', label: 'STSL' },
  { value: 'Bunker', label: 'Bunker' },
];

interface FeaturesFieldArrayProps {
  control: Control<NominationCreateInput>;
  disabled?: boolean;
}

export function FeaturesFieldArray({ control, disabled }: FeaturesFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parcels',
  });

  return (
    <Stack gap="xs">
      {fields.length === 0 && (
        <Text size="sm" c="dimmed">
          No cargo parcels added.
        </Text>
      )}
      {fields.map((field, index) => (
        <Group key={field.id} align="flex-end" gap="xs">
          <Controller
            control={control}
            name={`parcels.${index}.product`}
            render={({ field: f, fieldState }) => (
              <CargoNamePicker
                label={index === 0 ? 'Product' : undefined}
                placeholder="e.g. Soybeans"
                style={{ flex: 3 }}
                disabled={disabled}
                error={fieldState.error?.message}
                value={f.value}
                onChange={f.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name={`parcels.${index}.quantity`}
            render={({ field: f, fieldState }) => (
              <NumberInput
                label={index === 0 ? 'Quantity' : undefined}
                placeholder="e.g. 50000"
                min={0}
                style={{ flex: 2 }}
                disabled={disabled}
                error={fieldState.error?.message}
                value={f.value ?? ''}
                onChange={(val) => f.onChange(val === '' ? 0 : val)}
              />
            )}
          />
          <Controller
            control={control}
            name={`parcels.${index}.unit`}
            render={({ field: f, fieldState }) => (
              <TextInput
                label={index === 0 ? 'Unit' : undefined}
                placeholder="e.g. MT"
                style={{ flex: 1 }}
                disabled={disabled}
                error={fieldState.error?.message}
                {...f}
              />
            )}
          />
          <Controller
            control={control}
            name={`parcels.${index}.operation`}
            render={({ field: f, fieldState }) => (
              <Select
                label={index === 0 ? 'Operation' : undefined}
                placeholder="Select..."
                data={OPERATION_OPTIONS}
                style={{ flex: 2 }}
                disabled={disabled}
                error={fieldState.error?.message}
                value={f.value ?? null}
                onChange={(val) => f.onChange(val ?? '')}
                comboboxProps={{ withinPortal: true }}
              />
            )}
          />
          {!disabled && (
            <Button
              color="red"
              variant="subtle"
              size="compact-sm"
              onClick={() => remove(index)}
              aria-label="Remove row"
            >
              x
            </Button>
          )}
        </Group>
      ))}
      {!disabled && (
        <Button
          variant="outline"
          size="xs"
          onClick={() => append({ product: '', quantity: 0, unit: '', operation: '' })}
        >
          Add row
        </Button>
      )}
    </Stack>
  );
}
