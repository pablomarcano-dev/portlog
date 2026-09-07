import { Button, Group, Modal, Select, Stack, Textarea, TextInput } from '@mantine/core';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CargoCreateSchema, type CargoCategory, type CargoCreateInput } from '@portlog/schemas';
import { cargoesApi, type CargoRecord } from '../../../lib/api/master-data/cargoes';

interface Props {
  opened: boolean;
  category: CargoCategory;
  onClose: () => void;
  onCreated: (cargo: CargoRecord) => void;
}

const UNIT_OPTIONS = ['BBL', 'Bbls', 'MT', 'M/T', 'KG', 'LT', 'L/T'].map((value) => ({
  value,
  label: value,
}));

export function NewCargoModal({ opened, category, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const form = useForm<CargoCreateInput>({
    resolver: zodResolver(CargoCreateSchema),
    defaultValues: { name: '', bblUnit: '', category, comments: '' },
  });

  useEffect(() => {
    if (opened) form.setValue('category', category);
    else form.reset({ name: '', bblUnit: '', category, comments: '' });
  }, [category, opened, form]);

  const create = useMutation({
    mutationFn: cargoesApi.create,
    onSuccess: (cargo) => {
      void qc.invalidateQueries({ queryKey: ['cargoes'] });
      onCreated(cargo);
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New Product" size="sm">
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Product name"
            placeholder="e.g. Crude Oil"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Controller
            control={form.control}
            name="bblUnit"
            render={({ field, fieldState }) => (
              <Select
                label="Default unit"
                placeholder="Select unit"
                searchable
                data={UNIT_OPTIONS}
                value={field.value || null}
                onChange={(value) => field.onChange(value ?? '')}
                error={fieldState.error?.message}
                required
              />
            )}
          />
          <Controller
            control={form.control}
            name="category"
            render={({ field }) => (
              <Select
                label="Category"
                data={[
                  { value: 'SN', label: 'SN — Standard' },
                  { value: 'OT', label: 'OT' },
                ]}
                value={field.value}
                onChange={(value) => field.onChange(value ?? category)}
                disabled={category === 'OT'}
                allowDeselect={false}
              />
            )}
          />
          <Textarea
            label="Comments"
            placeholder="Optional product notes"
            autosize
            minRows={2}
            error={form.formState.errors.comments?.message}
            {...form.register('comments')}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Product
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
