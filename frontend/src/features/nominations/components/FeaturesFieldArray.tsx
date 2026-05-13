import { useFieldArray, Controller } from 'react-hook-form';
import type { Control } from 'react-hook-form';
import { Button, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import type { NominationCreateInput } from '@portlog/schemas';

interface FeaturesFieldArrayProps {
  control: Control<NominationCreateInput>;
  disabled?: boolean;
}

export function FeaturesFieldArray({ control, disabled }: FeaturesFieldArrayProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'features',
  });

  return (
    <Stack gap="xs">
      {fields.length === 0 && (
        <Text size="sm" c="dimmed">
          No cargo features added.
        </Text>
      )}
      {fields.map((field, index) => (
        <Group key={field.id} align="flex-end" gap="xs">
          <Controller
            control={control}
            name={`features.${index}.product`}
            render={({ field: f, fieldState }) => (
              <TextInput
                label={index === 0 ? 'Product' : undefined}
                placeholder="e.g. Soybeans"
                style={{ flex: 3 }}
                disabled={disabled}
                error={fieldState.error?.message}
                {...f}
              />
            )}
          />
          <Controller
            control={control}
            name={`features.${index}.quantity`}
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
            name={`features.${index}.unit`}
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
            name={`features.${index}.operation`}
            render={({ field: f, fieldState }) => (
              <TextInput
                label={index === 0 ? 'Operation' : undefined}
                placeholder="LOAD / DISCHARGE"
                style={{ flex: 2 }}
                disabled={disabled}
                error={fieldState.error?.message}
                {...f}
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
