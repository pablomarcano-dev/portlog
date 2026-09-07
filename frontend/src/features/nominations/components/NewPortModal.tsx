import { useEffect, useState } from 'react';
import { ActionIcon, Button, Group, Modal, Select, Stack, TextInput, Tooltip } from '@mantine/core';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PortCreateSchema } from '@portlog/schemas';
import type { PortCreateInput } from '@portlog/schemas';
import { apiRequest } from '../../../lib/api/client';
import { useEmailGroups } from '../../../lib/api/master-data/email-groups';
import { NewEmailGroupModal } from './NewEmailGroupModal';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (id: string, name: string) => void;
  branchId: string | undefined;
}

export function NewPortModal({ opened, onClose, onCreated, branchId }: Props) {
  const qc = useQueryClient();
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const emailGroupsQuery = useEmailGroups({ pageSize: 100 });

  const form = useForm<PortCreateInput>({
    resolver: zodResolver(PortCreateSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      country: '',
      emailGroup: '',
      branchId,
      terminalContacts: [],
    },
  });

  const { register, handleSubmit, formState, reset, control, setValue } = form;

  useEffect(() => {
    form.setValue('branchId', branchId ?? '', { shouldValidate: opened });
  }, [branchId, opened]);

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
    <>
      <NewEmailGroupModal
        opened={newGroupOpen}
        onClose={() => setNewGroupOpen(false)}
        onCreated={(name) => setValue('emailGroup', name, { shouldDirty: true })}
      />
      <Modal opened={opened && !newGroupOpen} onClose={handleClose} title="New Port" size="md">
        <form onSubmit={handleSubmit((v) => create.mutate(v))} noValidate>
          <Stack gap="sm">
            <TextInput
              label="Name"
              placeholder="e.g. Rotterdam"
              required
              error={formState.errors.name?.message}
              {...register('name')}
            />
            <input type="hidden" {...register('branchId')} />
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
            <Group gap={6} align="flex-end" wrap="nowrap">
              <Controller
                control={control}
                name="emailGroup"
                render={({ field, fieldState }) => (
                  <Select
                    style={{ flex: 1 }}
                    label="Email Group"
                    placeholder="Search email groups…"
                    searchable
                    clearable
                    data={(emailGroupsQuery.data?.items ?? []).map((group) => ({
                      value: group.name,
                      label: `${group.name} (${group.memberCount})`,
                    }))}
                    value={field.value || null}
                    onChange={(value) => field.onChange(value ?? '')}
                    error={fieldState.error?.message}
                    nothingFoundMessage="No email groups found"
                  />
                )}
              />
              <Tooltip label="Create email group">
                <ActionIcon
                  variant="default"
                  size="lg"
                  aria-label="Create email group"
                  onClick={() => setNewGroupOpen(true)}
                >
                  +
                </ActionIcon>
              </Tooltip>
            </Group>

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
    </>
  );
}
