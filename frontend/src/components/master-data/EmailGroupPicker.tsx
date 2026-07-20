import { useState } from 'react';
import { Box, Button, Group, MultiSelect, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEmailGroups, emailGroupQueryOptions } from '../../lib/api/master-data/email-groups';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One recipient field the picker can append resolved group emails into. */
export interface EmailRecipientTarget {
  /** Stable key for the button (e.g. 'to'). */
  key: string;
  /** Button caption; rendered as "+ {label}" (e.g. 'To'). */
  label: string;
  /** Current recipients in the field. */
  value: string[];
  /** Called with the merged, de-duplicated recipient list. */
  onChange: (next: string[]) => void;
}

interface EmailGroupPickerProps {
  /** Recipient fields (To / CC / BCC …) group emails can be added to. */
  targets: EmailRecipientTarget[];
  disabled?: boolean;
  /** Heading above the control. Defaults to "Add from group". */
  label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Searchable email-group selector that resolves a group's members to their
 * email addresses and appends them (de-duplicated) to a chosen recipient field.
 *
 * Shared across every email-recipient surface so groups can be searched and
 * added wherever recipients are entered.
 */
export function EmailGroupPicker({
  targets,
  disabled,
  label = 'Add from group',
}: EmailGroupPickerProps) {
  const qc = useQueryClient();
  const emailGroupsQuery = useEmailGroups({ pageSize: 100 });
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(false);

  const groupSelectData =
    emailGroupsQuery.data?.items.map((g) => ({
      value: g.id,
      label: `${g.name} (${g.memberCount})`,
    })) ?? [];

  // Resolve selected group IDs → member emails, append to the target field.
  async function handleAdd(target: EmailRecipientTarget) {
    if (!selectedGroupIds.length) return;
    setIsResolving(true);
    try {
      const fullGroups = await Promise.all(
        selectedGroupIds.map((id) => qc.fetchQuery(emailGroupQueryOptions(id))),
      );
      const newEmails = fullGroups.flatMap((g) => g.members.map((m) => m.email));
      const merged = Array.from(new Set([...target.value, ...newEmails]));
      target.onChange(merged);
      setSelectedGroupIds([]);
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <Box
      p="xs"
      style={{
        border: '1px solid var(--mantine-color-gray-2)',
        borderRadius: 'var(--mantine-radius-sm)',
        background: 'var(--mantine-color-gray-0)',
      }}
    >
      <Text size="xs" c="dimmed" mb={6}>
        {label}
      </Text>
      <Group gap="xs" align="flex-end">
        <MultiSelect
          style={{ flex: 1 }}
          placeholder="Search groups…"
          data={groupSelectData}
          value={selectedGroupIds}
          onChange={setSelectedGroupIds}
          searchable
          clearable
          disabled={disabled}
          size="xs"
          nothingFoundMessage="No groups found"
        />
        {targets.map((target) => (
          <Button
            key={target.key}
            size="xs"
            variant="light"
            disabled={disabled || !selectedGroupIds.length}
            loading={isResolving}
            onClick={() => void handleAdd(target)}
          >
            + {target.label}
          </Button>
        ))}
      </Group>
    </Box>
  );
}
