import { useState } from 'react';
import {
  Drawer,
  Stack,
  Text,
  Button,
  Group,
  Textarea,
  TextInput,
  MultiSelect,
  Badge,
  Alert,
  Loader,
  Box,
} from '@mantine/core';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import type { SubDocType } from '@portlog/schemas';
import { emailGroupsQueryOptions } from '../../../lib/api/master-data/email-groups';
import { useEmailDispatch } from '../api/useEmailDispatch';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailComposeDrawerProps {
  opened: boolean;
  onClose: () => void;
  pedrId: string;
  subDocType: SubDocType;
  defaultSubject: string;
  defaultBody?: string;
}

const SUB_DOC_LABELS: Record<SubDocType, string> = {
  ACKNOWLEDGEMENT: 'Acknowledgement of Nomination',
  PREARRIVAL: 'Pre-Arrival Notification',
  ETA_ETB: 'ETA / ETB Notice',
  NOR: 'Notice of Readiness',
  SOF: 'Statement of Facts',
  CARGO_UPDATE: 'Cargo Update',
};

// ---------------------------------------------------------------------------
// Form schema
// ---------------------------------------------------------------------------

const composeSchema = z.object({
  toGroupIds: z.array(z.string()).min(1, 'Select at least one recipient group'),
  ccFreeText: z.string().default(''),
  subject: z.string().min(1, 'Subject is required'),
  bodyHtml: z.string().default(''),
});
type ComposeForm = z.infer<typeof composeSchema>;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmailComposeDrawer({
  opened,
  onClose,
  pedrId,
  subDocType,
  defaultSubject,
  defaultBody = '',
}: EmailComposeDrawerProps) {
  const emailGroupsQuery = useQuery(emailGroupsQueryOptions({ pageSize: 100 }));
  const dispatch = useEmailDispatch(pedrId);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ComposeForm>({
    resolver: zodResolver(composeSchema),
    defaultValues: {
      toGroupIds: [],
      ccFreeText: '',
      subject: defaultSubject,
      bodyHtml: defaultBody,
    },
  });

  const toGroupIds = watch('toGroupIds');

  // Build MultiSelect data from email groups
  const groupSelectData =
    emailGroupsQuery.data?.items.map((g) => ({
      value: g.id,
      label: g.name,
    })) ?? [];

  function handleClose() {
    reset({
      toGroupIds: [],
      ccFreeText: '',
      subject: defaultSubject,
      bodyHtml: defaultBody,
    });
    setResolveError(null);
    onClose();
  }

  async function onSubmit(values: ComposeForm) {
    setResolveError(null);

    // Resolve group IDs → email addresses
    const groups = emailGroupsQuery.data?.items ?? [];
    const selectedGroups = groups.filter((g) => values.toGroupIds.includes(g.id));

    if (selectedGroups.length === 0) {
      setResolveError('Could not resolve recipient groups. Please refresh and try again.');
      return;
    }

    // Collect all member emails from selected groups
    // EmailGroupListItem only has memberCount — we need full group data.
    // Since we only have list data here, call full group fetch for each selected group
    // For simplicity we use the group list response which has memberCount but not emails.
    // The user has selected groups; we pass group emails via a separate resolution step.
    // For M4-S6, we pass the group names resolved to emails from the cached full-group data.
    // Since the list query only returns memberCount, not emails, we build toAddresses from
    // group member emails that we need to fetch. To avoid N+1 fetches in the UI, we instead
    // pass the group IDs to the backend and let it resolve them there.
    // ARCHITECTURE NOTE: This simplified version passes placeholder emails from group names.
    // The backend already has access to group data; in a future story the endpoint should
    // accept groupIds directly. For now, we resolve emails client-side using the full group API.

    // Build toAddresses by fetching full group data for each selected group
    // We use a sequential approach since groups are small
    let toAddresses: string[] = [];
    try {
      const { emailGroupsApi } = await import('../../../lib/api/master-data/email-groups');
      const fullGroups = await Promise.all(selectedGroups.map((g) => emailGroupsApi.get(g.id)));
      toAddresses = fullGroups.flatMap((g) => g.members.map((m) => m.email));
    } catch {
      setResolveError('Failed to fetch email group members. Please try again.');
      return;
    }

    if (toAddresses.length === 0) {
      setResolveError('Selected groups have no members. Please add members to the groups first.');
      return;
    }

    // Parse CC free-text (comma-separated emails)
    const ccAddresses = values.ccFreeText
      ? values.ccFreeText
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean)
      : [];

    dispatch.mutate(
      {
        subDocType,
        toAddresses,
        ccAddresses,
        subject: values.subject,
        bodyHtml: values.bodyHtml || undefined,
      },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      title={
        <Text fw={600} size="sm">
          {SUB_DOC_LABELS[subDocType]}
        </Text>
      }
      position="right"
      size="md"
      padding="lg"
    >
      {emailGroupsQuery.isLoading ? (
        <Box ta="center" py="xl">
          <Loader size="sm" />
        </Box>
      ) : (
        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)}>
          <Stack gap="sm">
            {/* To — email group multi-select */}
            <div>
              <MultiSelect
                label="To"
                description="Select one or more email groups"
                placeholder="Select groups..."
                data={groupSelectData}
                value={toGroupIds}
                onChange={(val) => setValue('toGroupIds', val, { shouldValidate: true })}
                searchable
                required
                error={errors.toGroupIds?.message}
              />
              {toGroupIds.length > 0 && (
                <Group gap={4} mt={4}>
                  {toGroupIds.map((id) => {
                    const grp = emailGroupsQuery.data?.items.find((g) => g.id === id);
                    return grp ? (
                      <Badge key={id} size="xs" variant="light">
                        {grp.name} ({grp.memberCount})
                      </Badge>
                    ) : null;
                  })}
                </Group>
              )}
            </div>

            {/* CC — free-text */}
            <TextInput
              label="CC"
              description="Comma-separated email addresses (optional)"
              placeholder="cc@example.com, other@example.com"
              {...register('ccFreeText')}
              error={errors.ccFreeText?.message}
            />

            {/* Subject */}
            <TextInput
              label="Subject"
              required
              {...register('subject')}
              error={errors.subject?.message}
            />

            {/* Body */}
            <Textarea
              label="Body"
              description="Email body — leave blank to use the default template text"
              minRows={4}
              autosize
              {...register('bodyHtml')}
              error={errors.bodyHtml?.message}
            />

            {/* Attachment chip */}
            <Box>
              <Text size="xs" c="dimmed" mb={4}>
                Attachment
              </Text>
              <Badge variant="outline" leftSection="PDF">
                {subDocType.toLowerCase().replace(/_/g, '-')}.pdf
              </Badge>
            </Box>

            {/* Errors */}
            {resolveError && (
              <Alert color="red" title="Error">
                {resolveError}
              </Alert>
            )}

            {dispatch.isError && (
              <Alert color="red" title="Send failed">
                {dispatch.error instanceof Error
                  ? dispatch.error.message
                  : 'An unexpected error occurred.'}
              </Alert>
            )}

            {/* Actions */}
            <Group justify="flex-end" mt="sm">
              <Button variant="default" onClick={handleClose} disabled={dispatch.isPending}>
                Cancel
              </Button>
              <Button type="submit" loading={dispatch.isPending}>
                Send
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Drawer>
  );
}
