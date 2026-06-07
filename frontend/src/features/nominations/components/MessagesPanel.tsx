import { useRef, useState } from 'react';
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
  Modal,
  Divider,
  Button,
  ScrollArea,
  Checkbox,
} from '@mantine/core';
import { useNominationMessages } from '../api/useNominationMessages';
import { useNominationSendEmail } from '../api/useNominationSendEmail';
import type { NominationMessageItem } from '@portlog/schemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_LABELS: Record<string, string> = {
  ACKNOWLEDGEMENT: 'Acknowledgement',
  PREARRIVAL: 'Pre-arrival',
  ETA_ETB: 'ETA / ETB',
  NOR: 'NOR',
  SOF: 'SOF',
  CARGO_UPDATE: 'Cargo Update',
};

function formatType(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, ' ');
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${min}`;
}

function statusColor(status: NominationMessageItem['status']): string {
  if (status === 'SENT') return 'green';
  if (status === 'FAILED') return 'red';
  return 'gray';
}

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// ---------------------------------------------------------------------------
// Email viewer modal
// ---------------------------------------------------------------------------

interface EmailViewerProps {
  item: NominationMessageItem | null;
  nominationId: string;
  onClose: () => void;
}

function EmailViewer({ item, nominationId, onClose }: EmailViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resend = useNominationSendEmail(nominationId);

  function handleResend() {
    if (!item) return;
    resend.mutate(
      {
        subDocType: item.type,
        toAddresses: item.toAddresses,
        ccAddresses: item.ccAddresses,
        bccAddresses: [],
        subject: item.subject,
        bodyHtml: item.bodyHtml ?? '',
      },
      { onSuccess: onClose },
    );
  }

  function handleIframeLoad() {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const h = iframe.contentWindow.document.documentElement.scrollHeight;
    iframe.style.height = `${h + 8}px`;
  }

  if (!item) return null;

  return (
    <Modal
      opened={!!item}
      onClose={onClose}
      title={
        <Text fw={600} size="sm">
          {item.subject}
        </Text>
      }
      size="xl"
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <Stack gap="xs">
        {/* Meta */}
        <Table fz="xs" withRowBorders={false} style={{ tableLayout: 'fixed' }}>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td w={60} fw={600} c="dimmed">
                Type
              </Table.Td>
              <Table.Td>{formatType(item.type)}</Table.Td>
              <Table.Td w={60} fw={600} c="dimmed">
                Date
              </Table.Td>
              <Table.Td>{formatDate(item.sentAt ?? item.createdAt)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={600} c="dimmed">
                To
              </Table.Td>
              <Table.Td colSpan={3}>{item.toAddresses.join(', ') || '—'}</Table.Td>
            </Table.Tr>
            {item.ccAddresses.length > 0 && (
              <Table.Tr>
                <Table.Td fw={600} c="dimmed">
                  CC
                </Table.Td>
                <Table.Td colSpan={3}>{item.ccAddresses.join(', ')}</Table.Td>
              </Table.Tr>
            )}
            <Table.Tr>
              <Table.Td fw={600} c="dimmed">
                Sent by
              </Table.Td>
              <Table.Td colSpan={3}>{item.sentBy.email}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>

        <Divider />

        {/* Body */}
        {item.bodyHtml ? (
          <Box
            style={{
              border: '1px solid var(--mantine-color-gray-3)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={item.bodyHtml}
              sandbox="allow-same-origin"
              style={{ width: '100%', border: 'none', display: 'block', minHeight: 120 }}
              onLoad={handleIframeLoad}
            />
          </Box>
        ) : (
          <Text size="sm" c="dimmed" fs="italic">
            No message body available.
          </Text>
        )}

        {resend.isError && (
          <Alert color="red" title="Re-send failed">
            {resend.error instanceof Error ? resend.error.message : 'Unexpected error.'}
          </Alert>
        )}

        <Group justify="flex-end" mt="xs">
          <Button variant="default" onClick={onClose}>
            Close
          </Button>
          <Button variant="light" loading={resend.isPending} onClick={handleResend}>
            Re-send
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// MessagesPanel
// ---------------------------------------------------------------------------

interface MessagesPanelProps {
  nominationId: string;
}

function printMessage(item: NominationMessageItem): void {
  const win = window.open('', '_blank', 'width=700,height=600');
  if (!win) return;
  const body = item.bodyHtml
    ? item.bodyHtml
    : '<p style="color:#666;font-style:italic">No message body available.</p>';
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${item.subject}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; margin: 32px; }
  .meta { display: grid; grid-template-columns: 80px 1fr; gap: 4px 8px; font-size: 12px; margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 12px; }
  .label { font-weight: bold; color: #555; }
</style></head>
<body>
  <div class="meta">
    <span class="label">Subject:</span><span>${item.subject}</span>
    <span class="label">Type:</span><span>${formatType(item.type)}</span>
    <span class="label">Date:</span><span>${formatDate(item.sentAt ?? item.createdAt)}</span>
    <span class="label">To:</span><span>${item.toAddresses.join(', ')}</span>
    ${item.ccAddresses.length ? `<span class="label">CC:</span><span>${item.ccAddresses.join(', ')}</span>` : ''}
  </div>
  <div>${body}</div>
  <script>window.onload = function() { window.print(); }</script>
</body></html>`);
  win.document.close();
}

export function MessagesPanel({ nominationId }: MessagesPanelProps) {
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<NominationMessageItem | null>(null);
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

        <Tabs.Panel value="sent" pt="sm">
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
          </Group>

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

          {!isLoading && !isError && sentItems.length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="xl">
              {search ? 'No messages match your search.' : 'No emails sent yet.'}
            </Text>
          )}

          {!isLoading && !isError && sentItems.length > 0 && (
            <Table withTableBorder withColumnBorders fz="xs" style={{ tableLayout: 'fixed' }}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 32 }} />
                  <Table.Th style={{ width: 120 }}>Type</Table.Th>
                  <Table.Th style={{ width: 110 }}>Date</Table.Th>
                  <Table.Th>Subject</Table.Th>
                  <Table.Th style={{ width: 180 }}>To</Table.Th>
                  <Table.Th style={{ width: 60 }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sentItems.map((item) => (
                  <Table.Tr
                    key={item.id}
                    onClick={() => setViewItem(item)}
                    style={{ cursor: 'pointer' }}
                  >
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        size="xs"
                        checked={item.id === selectedId}
                        onChange={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{formatType(item.type)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ whiteSpace: 'nowrap' }}>
                        {formatDate(item.sentAt ?? item.createdAt)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" title={item.subject}>
                        {truncate(item.subject, 80)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" title={item.toAddresses.join(', ')}>
                        {truncate(item.toAddresses.join(', '), 30)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="xs" color={statusColor(item.status)}>
                        {item.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="drafts" pt="sm">
          <Stack align="center" py="xl" gap="xs">
            <Text size="sm" c="dimmed">
              No drafts. Use the action buttons to compose.
            </Text>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      <EmailViewer item={viewItem} nominationId={nominationId} onClose={() => setViewItem(null)} />
    </Box>
  );
}
