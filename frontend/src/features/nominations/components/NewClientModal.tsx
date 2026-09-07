import { useEffect } from 'react';
import {
  Alert,
  Button,
  Grid,
  Group,
  Modal,
  MultiSelect,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ClientCreateSchema, type ClientCreateInput } from '@portlog/schemas';
import { EmailChipsInput } from '../../../components/master-data/EmailChipsInput';
import { clientsApi } from '../../../lib/api/master-data/clients';
import { useContacts } from '../../../lib/api/master-data/contacts';
import { useEmailGroups } from '../../../lib/api/master-data/email-groups';

interface NewClientModalProps {
  opened: boolean;
  onClose: () => void;
  onCreated: (client: { id: string; name: string }) => void;
}

const EMPTY_CLIENT: ClientCreateInput = {
  name: '',
  phone: '',
  mobile: '',
  billingAddress: '',
  emails: [],
  emailGroupId: null,
  contactIds: [],
  nominationInstructions: '',
};

export function NewClientModal({ opened, onClose, onCreated }: NewClientModalProps) {
  const queryClient = useQueryClient();
  const contactsQuery = useContacts({ limit: 100 });
  const emailGroupsQuery = useEmailGroups({ pageSize: 100 });
  const form = useForm<ClientCreateInput>({
    resolver: zodResolver(ClientCreateSchema),
    defaultValues: EMPTY_CLIENT,
  });

  useEffect(() => {
    if (!opened) form.reset(EMPTY_CLIENT);
  }, [form, opened]);

  const createClient = useMutation({
    mutationFn: clientsApi.create,
    onSuccess: (client) => {
      void queryClient.invalidateQueries({ queryKey: ['clients'] });
      void queryClient.invalidateQueries({
        queryKey: ['entity-picker', '/master-data/clients'],
      });
      onCreated({ id: client.id, name: client.name });
      form.reset(EMPTY_CLIENT);
      onClose();
    },
  });

  function handleClose() {
    if (createClient.isPending) return;
    createClient.reset();
    form.reset(EMPTY_CLIENT);
    onClose();
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Add client to nomination" size="lg">
      <form onSubmit={form.handleSubmit((values) => createClient.mutate(values))} noValidate>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Create the client here and it will be selected on this nomination immediately. You can
            complete tariffs and additional addresses later in Master Data.
          </Text>

          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Client name"
                placeholder="Company or account name"
                required
                autoFocus
                error={form.formState.errors.name?.message}
                {...form.register('name')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Controller
                control={form.control}
                name="emails"
                render={({ field, fieldState }) => (
                  <EmailChipsInput
                    label="Email addresses"
                    placeholder="operations@example.com"
                    value={field.value ?? []}
                    onChange={field.onChange}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Telephone"
                placeholder="+1 555 0100"
                error={form.formState.errors.phone?.message}
                {...form.register('phone')}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <TextInput
                label="Mobile"
                placeholder="+1 555 0101"
                error={form.formState.errors.mobile?.message}
                {...form.register('mobile')}
              />
            </Grid.Col>
          </Grid>

          <TextInput
            label="Billing address"
            description="Used in the administration and invoicing section of the instruction sheet"
            placeholder="Address to appear on invoices"
            error={form.formState.errors.billingAddress?.message}
            {...form.register('billingAddress')}
          />

          <Grid gutter="sm">
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Controller
                control={form.control}
                name="contactIds"
                render={({ field, fieldState }) => (
                  <MultiSelect
                    label="Associated contacts"
                    placeholder="Select people"
                    searchable
                    clearable
                    value={field.value ?? []}
                    onChange={field.onChange}
                    data={(contactsQuery.data?.items ?? []).map((contact) => ({
                      value: contact.id,
                      label: contact.name,
                    }))}
                    error={fieldState.error?.message}
                    nothingFoundMessage={
                      contactsQuery.isLoading ? 'Loading contacts…' : 'No contacts found'
                    }
                  />
                )}
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6 }}>
              <Controller
                control={form.control}
                name="emailGroupId"
                render={({ field, fieldState }) => (
                  <Select
                    label="Email group"
                    placeholder="Select a distribution list"
                    searchable
                    clearable
                    value={field.value ?? null}
                    onChange={field.onChange}
                    data={(emailGroupsQuery.data?.items ?? []).map((group) => ({
                      value: group.id,
                      label: `${group.name} (${group.memberCount})`,
                    }))}
                    error={fieldState.error?.message}
                    nothingFoundMessage={
                      emailGroupsQuery.isLoading ? 'Loading groups…' : 'No email groups found'
                    }
                  />
                )}
              />
            </Grid.Col>
          </Grid>

          <Textarea
            label="Nomination instructions"
            description="Standing client requirements added to every generated nomination instruction sheet"
            placeholder="Reporting intervals, communication rules, PDA requirements, invoicing notes…"
            autosize
            minRows={5}
            error={form.formState.errors.nominationInstructions?.message}
            {...form.register('nominationInstructions')}
          />

          {createClient.isError && (
            <Alert color="red" title="Client could not be created">
              Please review the information and try again.
            </Alert>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose} disabled={createClient.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={createClient.isPending}>
              Add and select client
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
