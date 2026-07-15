import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PortCreateSchema } from '@portlog/schemas';
import type { PortCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

export function NewPortModal({ opened, onClose, onCreated }: Props) {
  const qc = useQueryClient();

  const form = useForm<PortCreateInput>({
    resolver: zodResolver(PortCreateSchema),
    defaultValues: { name: '', abbreviation: '', country: '', emailGroup: '' },
  });

  const { register, handleSubmit, formState, reset } = form;

  const create = useMutation({
    mutationFn: (data: PortCreateInput) =>
      apiRequest<{ id: string; name: string }>('/master-data/ports', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (port) => {
      void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/ports'] });
      void qc.invalidateQueries({ queryKey: ['ports-for-vessel-fetch'] });
      onCreated(port.id, port.name);
      reset();
      onClose();
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="New Port" size="md">
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Rotterdam"
            required
            error={formState.errors.name?.message}
            {...register('name')}
          />
          <TextInput
            label="Acronym"
            placeholder="e.g. RTM"
            error={formState.errors.abbreviation?.message}
            {...register('abbreviation')}
          />
          <TextInput
            label="Country"
            placeholder="e.g. Netherlands"
            error={formState.errors.country?.message}
            {...register('country')}
          />
          <TextInput
            label="Email Group"
            placeholder="e.g. rotterdam-ops"
            error={formState.errors.emailGroup?.message}
            {...register('emailGroup')}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Port
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
