import { useState } from 'react';
import {
  Box,
  Tabs,
  Table,
  Text,
  TextInput,
  Group,
  Badge,
  Loader,
  Alert,
  ActionIcon,
  Stack,
  Tooltip,
} from '@mantine/core';
import { useNominationMessages } from '../api/useNominationMessages';
import type { NominationMessageItem } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: NominationMessageItem['status']): string {
  if (status === 'SENT') return 'green';
  if (status === 'FAILED') return 'red';
  return 'gray';
}

function truncateId(id: string): string {
  return id.slice(0, 8);
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatType(type: string): string {
  return type.replace(/_/g, ' ');
}

function formatAddresses(addrs: string[]): string {
  return addrs.join(', ') || '—';
}

function printMessage(item: NominationMessageItem): void {
  const win = window.open('', '_blank', 'width=700,height=600');
  if (!win) return;

  const body = item.bodyHtml
    ? item.bodyHtml
    : '<p style="color:#666;font-style:italic">No message body available.</p>';

  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${item.subject}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 13px; margin: 32px; color: #222; }
    .header { border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 20px; }
    .header h2 { margin: 0 0 8px; font-size: 16px; }
    .meta { display: grid; grid-template-columns: 80px 1fr; gap: 4px 8px; font-size: 12px; }
    .meta .label { font-weight: bold; color: #555; }
    .body { margin-top: 24px; line-height: 1.6; }
    @media print { body { margin: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h2>${item.subject}</h2>
    <div class="meta">
      <span class="label">Type:</span><span>${formatType(item.type)}</span>
      <span class="label">Date:</span><span>${formatDate(item.sentAt ?? item.createdAt)}</span>
      <span class="label">To:</span><span>${formatAddresses(item.toAddresses)}</span>
      ${item.ccAddresses.length ? `<span class="label">CC:</span><span>${formatAddresses(item.ccAddresses)}</span>` : ''}
      <span class="label">Sent by:</span><span>${item.sentBy.email}</span>
      <span class="label">Status:</span><span>${item.status}</span>
    </div>
  </div>
  <div class="body">${body}</div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`);
  win.document.close();
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MessagesPanelProps {
  nominationId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MessagesPanel({ nominationId }: MessagesPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data, isLoading, isError, error } = useNominationMessages(nominationId);

  const sentItems = (data?.items ?? []).filter((item) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      item.subject.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.toAddresses.some((a) => a.toLowerCase().includes(q)) ||
      item.ccAddresses.some((a) => a.toLowerCase().includes(q))
    );
  });

  const selectedItem = sentItems.find((i) => i.id === selectedId) ?? null;

  return (
    <Box>
      <Tabs defaultValue="sent">
        <Tabs.List>
          <Tabs.Tab value="sent">
            Sent
            {data && data.items.length > 0 && (
              <Badge size="xs" ml={6} variant="light">
                {data.items.length}
              </Badge>
            )}
          </Tabs.Tab>
          <Tabs.Tab value="drafts">Drafts</Tabs.Tab>
        </Tabs.List>

        {/* Sent tab */}
        <Tabs.Panel value="sent" pt="sm">
          {/* Toolbar */}
          <Group mb="sm" gap="xs">
            <TextInput
              size="xs"
              placeholder="Search by subject, type, or address..."
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              style={{ flex: 1 }}
            />
            <Tooltip
              label={selectedItem ? 'Print selected message' : 'Select a message to print'}
              withArrow
            >
              <ActionIcon
                variant="default"
                size="sm"
                disabled={!selectedItem}
                onClick={() => selectedItem && printMessage(selectedItem)}
              >
                <span style={{ fontSize: 12 }}>&#128438;</span>
              </ActionIcon>
            </Tooltip>
            <Tooltip
              label={selectedItem ? 'Re-Send (coming soon)' : 'Select a message to re-send'}
              withArrow
            >
              <ActionIcon variant="default" size="sm" disabled>
                <span style={{ fontSize: 12 }}>&#9993;</span>
              </ActionIcon>
            </Tooltip>
          </Group>

          {/* Loading / error states */}
          {isLoading && (
            <Box ta="center" py="xl">
              <Loader size="sm" />
            </Box>
          )}

          {isError && (
            <Alert color="red" title="Failed to load messages">
              {error instanceof Error ? error.message : 'An unexpected error occurred.'}
            </Alert>
          )}

          {/* Empty state */}
          {!isLoading && !isError && sentItems.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {search ? 'No messages match your search.' : 'No emails sent yet.'}
            </Text>
          )}

          {/* Table */}
          {!isLoading && !isError && sentItems.length > 0 && (
            <Table withTableBorder withColumnBorders fz="xs" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 80 }}>ID</Table.Th>
                  <Table.Th style={{ width: 110 }}>Type</Table.Th>
                  <Table.Th style={{ width: 130 }}>Date</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th style={{ width: 160 }}>To</Table.Th>
                  <Table.Th style={{ width: 160 }}>Copy</Table.Th>
                  <Table.Th style={{ width: 70 }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sentItems.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <Table.Tr
                      key={item.id}
                      onClick={() => setSelectedId(isSelected ? null : item.id)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isSelected ? 'var(--mantine-color-blue-1)' : undefined,
                      }}
                    >
                      <Table.Td>
                        <Text
                          size="xs"
                          ff="monospace"
                          title={item.id}
                          style={{ cursor: 'default' }}
                        >
                          {truncateId(item.id)}
                        </Text>
                      </Table.Td>
                      <Table.Td>{formatType(item.type)}</Table.Td>
                      <Table.Td>{formatDate(item.sentAt ?? item.createdAt)}</Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2}>
                          {item.subject}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2}>
                          {formatAddresses(item.toAddresses)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" lineClamp={2}>
                          {formatAddresses(item.ccAddresses)}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge size="xs" color={statusColor(item.status)}>
                          {item.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        {/* Drafts tab — empty state placeholder */}
        <Tabs.Panel value="drafts" pt="sm">
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              No drafts. Use the action buttons to compose.
            </Text>
          </Stack>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
