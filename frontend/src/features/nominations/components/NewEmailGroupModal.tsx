import { useEffect } from 'react';
import { Button, Group, Modal, Stack, TagsInput, Textarea, TextInput } from '@mantine/core';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EmailGroupCreateSchema, type EmailGroupCreateInput } from '@portlog/schemas';
import { emailGroupsApi } from '../../../lib/api/master-data/email-groups';

interface Props {
  opened: boolean;
  onClose: () => void;
  onCreated: (name: string) => void;
}

export function NewEmailGroupModal({ opened, onClose, onCreated }: Props) {
  const qc = useQueryClient();
  const form = useForm<EmailGroupCreateInput>({
    resolver: zodResolver(EmailGroupCreateSchema),
    defaultValues: { name: '', description: '', members: [] },
  });

  useEffect(() => {
    if (!opened) form.reset();
  }, [opened, form]);

  const create = useMutation({
    mutationFn: emailGroupsApi.create,
    onSuccess: (group) => {
      void qc.invalidateQueries({ queryKey: ['email-groups'] });
      onCreated(group.name);
      form.reset();
      onClose();
    },
  });

  return (
    <Modal opened={opened} onClose={onClose} title="New Email Group" size="md">
      <form onSubmit={form.handleSubmit((values) => create.mutate(values))} noValidate>
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. Montevideo Terminal"
            required
            error={form.formState.errors.name?.message}
            {...form.register('name')}
          />
          <Textarea
            label="Description"
            placeholder="What this distribution group is used for"
            autosize
            minRows={2}
            error={form.formState.errors.description?.message}
            {...form.register('description')}
          />
          <Controller
            control={form.control}
            name="members"
            render={({ field, fieldState }) => (
              <TagsInput
                label="Member emails"
                description="Press Enter after each address"
                placeholder="operations@example.com"
                value={(field.value ?? []).map((member) => member.email)}
                onChange={(emails) =>
                  field.onChange(emails.map((email, order) => ({ email, order })))
                }
                error={fieldState.error?.message}
                splitChars={[',', ';', ' ']}
                clearable
              />
            )}
          />
          <Group justify="flex-end" mt="xs">
            <Button variant="default" onClick={onClose} disabled={create.isPending}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending}>
              Create Group
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
