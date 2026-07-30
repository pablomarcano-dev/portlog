import { useState } from 'react';
import { Box, Button, Group, MultiSelect, Text } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEmailGroups, emailGroupQueryOptions } from '../../lib/api/master-data/email-groups';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One recipient field the picker can write resolved group emails into. */
export interface EmailRecipientTarget {
  /** Stable key for the button (e.g. 'to'). */
  key: string;
  /** Button caption; rendered as "+ {label}" (e.g. 'To'). */
  label: string;
  /** Current recipients in the field. */
  value: string[];
  /** Called with the de-duplicated recipient list, appended or replaced. */
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
 * email addresses and writes them (de-duplicated) into a chosen recipient
 * field — either appended ("+ To") or replacing what is there ("⇄").
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

  /**
   * Resolve selected group IDs → member emails and write them into the target
   * field. `mode: 'replace'` drops whatever is already there, which is what
   * swapping distribution lists needs — e.g. a message pre-filled with the
   * charterer's group that has to go to the operator's group instead. Appending
   * would leave the charterer copied in.
   */
  async function applyGroups(target: EmailRecipientTarget, mode: 'append' | 'replace') {
    if (!selectedGroupIds.length) return;
    setIsResolving(true);
    try {
      const fullGroups = await Promise.all(
        selectedGroupIds.map((id) => qc.fetchQuery(emailGroupQueryOptions(id))),
      );
      const groupEmails = fullGroups.flatMap((g) => g.members.map((m) => m.email));
      const next = mode === 'replace' ? groupEmails : [...target.value, ...groupEmails];
      target.onChange(Array.from(new Set(next)));
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
          <Button.Group key={target.key}>
            <Button
              size="xs"
              variant="light"
              disabled={disabled || !selectedGroupIds.length}
              loading={isResolving}
              onClick={() => void applyGroups(target, 'append')}
              title={`Add the selected group(s) to ${target.label}`}
            >
              + {target.label}
            </Button>
            <Button
              size="xs"
              variant="light"
              disabled={disabled || !selectedGroupIds.length}
              loading={isResolving}
              onClick={() => void applyGroups(target, 'replace')}
              title={`Replace ${target.label} with the selected group(s)`}
              aria-label={`Replace ${target.label} with the selected group or groups`}
            >
              ⇄
            </Button>
          </Button.Group>
        ))}
      </Group>
    </Box>
  );
}
