import { useFieldArray, Controller } from 'react-hook-form';
import type { Control, UseFormSetValue } from 'react-hook-form';
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useState } from 'react';
import type { NominationCreateInput, NominationKind } from '@portlog/schemas';
import { CargoNamePicker } from './CargoNamePicker';
import { unitSelectData } from '../parcelUnits';
import { NewCargoModal } from './NewCargoModal';

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
  /** Nomination series. OT restricts the product picker to OT-marked products. */
  kind?: NominationKind;
  setValue: UseFormSetValue<NominationCreateInput>;
}

export function ParcelsFieldArray({
  control,
  setValue,
  disabled,
  kind = 'SN',
}: ParcelsFieldArrayProps) {
  const [newCargoIndex, setNewCargoIndex] = useState<number | null>(null);
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'parcels',
  });
  const productCategory = kind === 'OT' ? 'OT' : undefined;

  return (
    <>
      <NewCargoModal
        opened={newCargoIndex !== null}
        category={kind === 'OT' ? 'OT' : 'SN'}
        onClose={() => setNewCargoIndex(null)}
        onCreated={(cargo) => {
          if (newCargoIndex === null) return;
          setValue(`parcels.${newCargoIndex}.product`, cargo.name, { shouldDirty: true });
          setValue(`parcels.${newCargoIndex}.unit`, cargo.bblUnit, { shouldDirty: true });
        }}
      />
      <Stack gap="xs">
        {kind === 'OT' && (
          <Text size="xs" c="dimmed">
            OT nomination — only products marked OT can be added.
          </Text>
        )}
        {fields.length === 0 && (
          <Text size="sm" c="dimmed">
            No parcels added.
          </Text>
        )}
        {fields.map((field, index) => (
          <Group key={field.id} align="flex-end" gap="xs">
            <Group gap={4} align="flex-end" wrap="nowrap" style={{ flex: 3 }}>
              <Controller
                control={control}
                name={`parcels.${index}.product`}
                render={({ field: f, fieldState }) => (
                  <CargoNamePicker
                    label={index === 0 ? 'Product' : undefined}
                    placeholder="e.g. Soybeans"
                    style={{ flex: 1 }}
                    disabled={disabled}
                    category={productCategory}
                    error={fieldState.error?.message}
                    value={f.value}
                    onChange={f.onChange}
                    onCargoSelect={(cargo) =>
                      setValue(`parcels.${index}.unit`, cargo.bblUnit, { shouldDirty: true })
                    }
                  />
                )}
              />
              {!disabled && (
                <Tooltip label="Create product">
                  <ActionIcon
                    variant="default"
                    size="lg"
                    aria-label={`Create product for parcel ${index + 1}`}
                    onClick={() => setNewCargoIndex(index)}
                  >
                    +
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
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
                  data={unitSelectData(f.value)}
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
    </>
  );
}
