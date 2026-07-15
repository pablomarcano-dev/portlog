import { useEffect } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { piersApi } from '../../../lib/api/master-data/ports';

interface Props {
  opened: boolean;
  portId: string | null;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
}

interface PierFormInput {
  name: string;
}

export function NewPierModal({ opened, portId, onClose, onCreated }: Props) {
  const qc = useQueryClient();

  const form = useForm<PierFormInput>({ defaultValues: { name: '' } });
  const { register, handleSubmit, formState, reset } = form;

  useEffect(() => {
    if (!opened) reset({ name: '' });
  }, [opened, reset]);

  const create = useMutation({
    mutationFn: (data: PierFormInput) => {
      if (!portId) throw new Error('No port selected.');
      return piersApi.create(portId, data.name);
    },
    onSuccess: (pier) => {
      if (portId) {
        void qc.invalidateQueries({
          queryKey: ['entity-picker', `/master-data/ports/${portId}/piers`],
        });
        void qc.invalidateQueries({ queryKey: ['piers', portId] });
      }
      onCreated(pier.id, pier.name);
      reset();
      onClose();
    },
  });

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="New Pier" size="sm">
      <form
        onSubmit={handleSubmit((v) => {
          if (!v.name.trim()) return;
          create.mutate(v);
        })}
        noValidate
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Berth 3"
            required
            error={formState.errors.name?.message}
            {...register('name', { required: true })}
          />

          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={handleClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Pier
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
