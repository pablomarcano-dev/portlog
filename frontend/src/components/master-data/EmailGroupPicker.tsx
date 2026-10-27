import {
  CLIENT_EMAIL_SLOT_LABELS,
  NominationClientEmailContextSchema,
  parseEmailList,
} from '@portlog/schemas';
import { allEmailGroupsOptions } from './directoryOptions';
import { clientQueryOptions } from '../../lib/api/master-data/clients';
import { apiRequest } from '../../lib/api/client';
import { useState, useEffect, useRef } from 'react';
import { Box, Button, Group, MultiSelect, Text } from '@mantine/core';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { emailGroupQueryOptions } from '../../lib/api/master-data/email-groups';

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
  nominationId?: string;
  /** Action dialogs only show the groups explicitly assigned to message slots. */
  nominationOnly?: boolean;
  clientIds?: string[];
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
  nominationId,
  nominationOnly = false,
  clientIds = [],
  disabled,
  label = 'Add from group',
}: EmailGroupPickerProps) {
  const qc = useQueryClient();
  const resolutionVersion = useRef(0);
  const currentAllowedIds = useRef(new Set<string>());
  const emailGroupsQuery = useQuery({ ...allEmailGroupsOptions(), enabled: !nominationOnly });
  const context = useQuery({
    queryKey: ['nominations', nominationId, 'client-email-context'],
    enabled: !!nominationId,
    queryFn: async () =>
      NominationClientEmailContextSchema.parse(
        await apiRequest<unknown>(`/nominations/${nominationId}/client-email-context`),
      ),
  });
  const ids = nominationOnly
    ? []
    : [...new Set([...clientIds, ...(context.data?.clientIds ?? [])])];
  const clients = useQueries({ queries: ids.map((id) => clientQueryOptions(id)) });
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isResolving, setIsResolving] = useState(false);
  useEffect(() => {
    resolutionVersion.current += 1;
    setSelectedGroupIds([]);
    setResolveError(null);
    setIsResolving(false);
    return () => {
      resolutionVersion.current += 1;
    };
  }, [nominationId]);

  const contextual = new Map<string, { value: string; label: string }>();
  for (const query of clients)
    for (const assignment of query.data?.emailGroups ?? []) {
      const group = assignment.emailGroup;
      const label = `${query.data!.name} · ${CLIENT_EMAIL_SLOT_LABELS[assignment.slot]}`;
      const previous = contextual.get(group.id);
      contextual.set(group.id, {
        value: group.id,
        label: previous
          ? `${previous.label}; ${label}`
          : `${group.name} (${group.members.length}) — ${label}`,
      });
    }
  if (nominationOnly) {
    for (const group of context.data?.messageGroups ?? []) {
      const order = ['1st', '2nd', '3rd'][group.messageOrder - 1];
      const label = `${order} message · ${group.clientName}`;
      const previous = contextual.get(group.id);
      contextual.set(group.id, {
        value: group.id,
        label: previous
          ? `${previous.label}; ${label}`
          : `${label} — ${group.name} (${group.memberCount})`,
      });
    }
  }
  const general = (emailGroupsQuery.data ?? [])
    .filter((g) => !contextual.has(g.id))
    .map((g) => ({ value: g.id, label: `${g.name} (${g.memberCount})` }));
  const groupSelectData = [
    ...(contextual.size
      ? [
          {
            group: nominationOnly ? 'Assigned nomination messages' : 'Nomination clients',
            items: [...contextual.values()],
          },
        ]
      : []),
    ...(!nominationOnly ? [{ group: 'All email groups', items: general }] : []),
  ];

  currentAllowedIds.current = new Set(contextual.keys());
  const allowedSelection = nominationOnly
    ? selectedGroupIds.filter((id) => contextual.has(id))
    : selectedGroupIds;
  const selectionUnavailable = Boolean(
    disabled ||
    isResolving ||
    (nominationOnly && (!nominationId || context.isLoading || context.isError)),
  );

  /**
   * Resolve selected group IDs → member emails and write them into the target
   * field. `mode: 'replace'` drops whatever is already there, which is what
   * swapping distribution lists needs — e.g. a message pre-filled with the
   * charterer's group that has to go to the operator's group instead. Appending
   * would leave the charterer copied in.
   */
  async function applyGroups(target: EmailRecipientTarget, mode: 'append' | 'replace') {
    const allowedIds = nominationOnly
      ? selectedGroupIds.filter((id) => contextual.has(id))
      : selectedGroupIds;
    if (!allowedIds.length || selectionUnavailable) return;
    const version = ++resolutionVersion.current;
    setIsResolving(true);
    setResolveError(null);
    try {
      const fullGroups = await Promise.all(
        allowedIds.map((id) => qc.fetchQuery({ ...emailGroupQueryOptions(id), staleTime: 0 })),
      );
      if (version !== resolutionVersion.current) return;
      if (nominationOnly && allowedIds.some((id) => !currentAllowedIds.current.has(id))) {
        setResolveError('The assigned groups changed. Select a current message group and retry.');
        return;
      }
      const groupEmails = parseEmailList(
        fullGroups.flatMap((g) => g.members.map((m) => m.email)).join(';'),
      );
      if (!groupEmails.length) {
        setResolveError(
          'The selected groups have no email addresses. Existing recipients were kept.',
        );
        return;
      }
      const next = mode === 'replace' ? groupEmails : [...target.value, ...groupEmails];
      target.onChange(parseEmailList(next.join(';')));
      setSelectedGroupIds([]);
    } catch (error) {
      if (version !== resolutionVersion.current) return;
      setResolveError(error instanceof Error ? error.message : 'Could not load group members.');
    } finally {
      if (version === resolutionVersion.current) setIsResolving(false);
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
        {nominationOnly ? 'Choose a nomination message group' : label}
      </Text>
      {nominationOnly && (
        <Text size="xs" c="dimmed" mb={6}>
          Select 1st, 2nd or 3rd message, then use + To, + CC or + BCC to add its addresses.
        </Text>
      )}
      {(resolveError ||
        (!nominationOnly && emailGroupsQuery.isError) ||
        context.isError ||
        clients.some((q) => q.isError)) && (
        <Text size="xs" c="red">
          {resolveError ?? 'Some email groups could not be loaded. Please retry.'}
        </Text>
      )}
      {nominationOnly && !nominationId && (
        <Text size="xs" c="dimmed" mb={6}>
          Save the nomination before selecting its assigned message groups.
        </Text>
      )}
      {nominationOnly && context.isError && (
        <Button
          size="compact-xs"
          variant="subtle"
          loading={context.isFetching}
          onClick={() => void context.refetch()}
        >
          Retry assigned groups
        </Button>
      )}
      {nominationOnly &&
        nominationId &&
        !context.isLoading &&
        !context.isError &&
        contextual.size === 0 && (
          <Text size="xs" c="dimmed" mb={6}>
            No message groups assigned. Assign nomination clients to 1st, 2nd or 3rd message and
            configure their matching groups in Clients.
          </Text>
        )}
      <Group gap="xs" align="flex-end">
        <MultiSelect
          style={{ flex: 1 }}
          placeholder="Search groups…"
          data={groupSelectData}
          value={allowedSelection}
          onChange={setSelectedGroupIds}
          searchable
          clearable
          disabled={selectionUnavailable}
          size="xs"
          nothingFoundMessage="No groups found"
        />
        {targets.map((target) => (
          <Button.Group key={target.key}>
            <Button
              size="xs"
              variant="light"
              disabled={selectionUnavailable || !allowedSelection.length}
              loading={isResolving}
              onClick={() => void applyGroups(target, 'append')}
              title={`Add the selected group(s) to ${target.label}`}
            >
              + {target.label}
            </Button>
            <Button
              size="xs"
              variant="light"
              disabled={selectionUnavailable || !allowedSelection.length}
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
