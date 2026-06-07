import { useFieldArray, Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Button, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import type { NominationCreateInput } from '@portlog/schemas';
import { CargoNamePicker } from './CargoNamePicker';

const UNIT_OPTIONS = [
  { value: 'Bbls', label: 'Bbls' },
  { value: 'Kg', label: 'Kg' },
  { value: 'Us/G', label: 'Us/G' },
  { value: 'C/M', label: 'C/M' },
  { value: 'L/T', label: 'L/T' },
  { value: 'M/T', label: 'M/T' },
  { value: 'Unit', label: 'Unit' },
];

const OPERATION_OPTIONS = [
  { value: 'Disch', label: 'Disch' },
  { value: 'Load', label: 'Load' },
  { value: 'Transit', label: 'Transit' },
  { value: 'STSD', label: 'STSD' },
  { value: 'STSL', label: 'STSL' },
  { value: 'Bunker', label: 'Bunker' },
];

interface ParcelsFieldArrayProps {
  control: Control<NominationCreateInput>;
  disabled?: boolean;
}

export function ParcelsFieldArray({ control, disabled }: ParcelsFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parcels',
  });

  return (
    <Stack gap="xs">
      {fields.length === 0 && (
        <Text size="sm" c="dimmed">
          No parcels added.
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
              <Select
                label={index === 0 ? 'Unit' : undefined}
                placeholder="Select..."
                data={UNIT_OPTIONS}
                style={{ flex: 1 }}
                disabled={disabled}
                error={fieldState.error?.message}
                value={f.value ?? null}
                onChange={(val) => f.onChange(val ?? '')}
                comboboxProps={{ withinPortal: true }}
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
