import { useEffect } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClientCreateSchema, type ClientCreateInput } from '@portlog/schemas';
import { clientsApi } from '../../../lib/api/master-data/clients';
import { ClientFields, EMPTY_CLIENT } from '../../../components/master-data/ClientFields';
export function NewClientModal({
  opened,
  onClose,
  onCreated,
  initialName = '',
}: {
  opened: boolean;
  initialName?: string;
  onClose: () => void;
  onCreated: (client: { id: string; name: string }) => void;
}) {
  const qc = useQueryClient();
  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(ClientCreateSchema),
    defaultValues: EMPTY_CLIENT,
  });
  const create = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (client) => {
      void qc.invalidateQueries({ queryKey: ['clients'] });
      void qc.invalidateQueries({ queryKey: ['entity-picker'] });
      onCreated(client);
      form.reset(EMPTY_CLIENT);
      onClose();
    },
  });
  useEffect(() => {
    if (opened) form.reset({ ...EMPTY_CLIENT, name: initialName });
  }, [opened, initialName, form]);
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!create.isPending) onClose();
      }}
      title="Add client"
      size="xl"
    >
      <form
        onSubmit={(event) => {
          event.stopPropagation();
          void form.handleSubmit((values) => create.mutate(values))(event);
        }}
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Create a new company in the shared Clients directory. To use an existing company, cancel
            and select it from the client list. Email groups are optional and can be configured
            later.
          </Text>
          <ClientFields form={form} />
          {create.isError && <Alert color="red">{create.error.message}</Alert>}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create client
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
