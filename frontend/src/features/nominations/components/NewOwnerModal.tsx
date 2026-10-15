import { useEffect } from 'react';
import { Alert, Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OwnerCreateSchema, type OwnerCreateInput } from '@portlog/schemas';
import { ownersApi } from '../../../lib/api/master-data/owners';

export function NewOwnerModal({
  opened,
  initialName = '',
  onClose,
  onCreated,
}: {
  opened: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (owner: { id: string; name: string }) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<OwnerCreateInput>({
    resolver: zodResolver(OwnerCreateSchema),
    defaultValues: { name: '' },
  });
  const create = useMutation({
    mutationFn: ownersApi.create,
    onSuccess: (owner) => {
      void qc.invalidateQueries({ queryKey: ['owners'] });
      void qc.invalidateQueries({ queryKey: ['clients', 'party-search'] });
      void qc.invalidateQueries({ queryKey: ['entity-picker', '/master-data/owners'] });
      onCreated(owner);
      onClose();
    },
  });
  useEffect(() => {
    if (opened) form.reset({ name: initialName });
  }, [opened, initialName, form]);
  return (
    <Modal opened={opened} onClose={() => !create.isPending && onClose()} title="Add owner">
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          void form.handleSubmit((values) => create.mutate(values))(event);
        }}
        noValidate
      >
        <Stack>
          <TextInput
            label="Name"
            required
            {...form.register('name')}
            error={form.formState.errors.name?.message}
          />
          <TextInput
            label="Phones"
            {...form.register('phones')}
            error={form.formState.errors.phones?.message}
          />
          <TextInput
            label="Physical Address"
            {...form.register('physicalAddress')}
            error={form.formState.errors.physicalAddress?.message}
          />
          {create.isError && <Alert color="red">{create.error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create owner
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
