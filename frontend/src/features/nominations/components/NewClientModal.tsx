import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClientCreateSchema } from '@portlog/schemas';
import type { ClientCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

/**
 * Inline client creation from the Sales modal. Only the essentials — full
 * client editing (addresses, tariff, instructions) lives in Master Data.
 */
export function NewClientModal({ opened, onClose, onCreated }: Props) {
  const qc = useQueryClient();

  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(ClientCreateSchema),
    defaultValues: { name: '', email: '', phone: '' },
  });

  const { register, handleSubmit, formState, reset } = form;

  const create = useMutation({
    mutationFn: (data: ClientCreateInput) =>
      apiRequest<{ id: string; name: string }>('/master-data/clients', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/clients'] });
      void qc.invalidateQueries({ queryKey: ['clients'] });
      onCreated(client.id, client.name);
      reset();
      onClose();
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="New Client" size="md">
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Acme Shipping S.A."
            required
            error={formState.errors.name?.message}
            {...register('name')}
          />
          <TextInput
            label="Email"
            placeholder="e.g. ops@acme.com"
            error={formState.errors.email?.message}
            {...register('email')}
          />
          <TextInput
            label="Phone"
            placeholder="e.g. +598 2 1234 5678"
            error={formState.errors.phone?.message}
            {...register('phone')}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Client
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
