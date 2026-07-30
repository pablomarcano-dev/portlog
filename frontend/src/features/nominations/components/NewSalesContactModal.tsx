import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SalesContactCreateSchema } from '@portlog/schemas';
import type { SalesContactCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
  /** Shown in the title, so it is clear which voucher line is being filled. */
  role?: 'Driver' | 'User';
}

/**
 * Inline sales-contact creation from the Sales modal, so a driver or user who
 * is not yet registered can be added without leaving the voucher. Full editing
 * (phone, ID document, vehicle) lives in Master Data → Sales Contacts.
 */
export function NewSalesContactModal({ opened, onClose, onCreated, role }: Props) {
  const qc = useQueryClient();

  const form = useForm<SalesContactCreateInput>({
    resolver: zodResolver(SalesContactCreateSchema),
    defaultValues: { name: '', mobile: '', documentNumber: '' },
  });

  const { register, handleSubmit, formState, reset } = form;

  const create = useMutation({
    mutationFn: (data: SalesContactCreateInput) =>
      apiRequest<{ id: string; name: string }>('/master-data/sales-contacts', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (contact) => {
      void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/sales-contacts'] });
      void qc.invalidateQueries({ queryKey: ['sales-contacts'] });
      onCreated(contact.id, contact.name);
      reset();
      onClose();
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={role ? `New Sales Contact — ${role}` : 'New Sales Contact'}
      size="md"
    >
      <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. J. Ramirez"
            required
            error={formState.errors.name?.message}
            {...register('name')}
          />
          <TextInput
            label="Mobile"
            placeholder="e.g. +58 414 085 8517"
            error={formState.errors.mobile?.message}
            {...register('mobile')}
          />
          <TextInput
            label="ID Document"
            placeholder="Cédula / national ID"
            error={formState.errors.documentNumber?.message}
            {...register('documentNumber')}
          />
          <TextInput
            label="Vehicle"
            placeholder="Unit or plate"
            error={formState.errors.vehicle?.message}
            {...register('vehicle')}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Contact
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
