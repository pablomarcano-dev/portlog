import { useRef, useState } from 'react';
import { Alert, Button, Checkbox, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  prearrivalFiles,
  recapFiles,
  recapPdf,
  type StoredFile,
  type RecapRecord,
} from '../api/nominationFiles';
import { AttachmentPreviewButton } from '../../../components/master-data/AttachmentPreviewButton';

interface Props {
  nominationId: string;
  kind: 'PREARRIVAL' | 'ETA_RECAP';
  selected: string[];
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onPendingChange: (busy: boolean) => void;
  onPreviewOpenChange: (open: boolean) => void;
}
export function SavedDocumentsPicker({
  nominationId,
  kind,
  selected,
  onAdd,
  onRemove,
  onPendingChange,
  onPreviewOpenChange,
}: Props) {
  const prearrival = useQuery({
    queryKey: ['prearrival-documents', nominationId],
    queryFn: () => prearrivalFiles(nominationId),
    enabled: kind === 'PREARRIVAL',
  });
  const recap = useQuery({
    queryKey: ['recap-documents', nominationId],
    queryFn: () => recapFiles(nominationId),
    enabled: kind === 'ETA_RECAP',
  });
  const query = kind === 'PREARRIVAL' ? prearrival : recap;
  const [generated, setGenerated] = useState<Record<string, StoredFile>>({});
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  async function addRecord(record: RecapRecord) {
    if (pending.current) return;
    const key = `${record.source}:${record.id}`;
    if (generated[key]) {
      onAdd(generated[key].id);
      return;
    }
    pending.current = true;
    setBusy(true);
    onPendingChange(true);
    setError('');
    try {
      const file = await recapPdf(nominationId, record);
      setGenerated((prev) => ({ ...prev, [key]: file }));
      onAdd(file.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not prepare the saved record');
    } finally {
      pending.current = false;
      setBusy(false);
      onPendingChange(false);
    }
  }
  function fileRow(file: StoredFile) {
    return (
      <Group key={file.id} justify="space-between">
        <Checkbox
          label={file.filename}
          checked={selected.includes(file.id)}
          disabled={busy}
          onChange={(e) => (e.currentTarget.checked ? onAdd(file.id) : onRemove(file.id))}
        />
        <AttachmentPreviewButton attachment={file} onPreviewOpenChange={onPreviewOpenChange} />
      </Group>
    );
  }
  return (
    <Stack gap="xs">
      <Text fw={600}>
        {kind === 'PREARRIVAL'
          ? `Terminal documents${prearrival.data?.terminal ? ` — ${prearrival.data.terminal.name}` : ''}`
          : 'Saved ETA and NOR records'}
      </Text>
      <Text size="sm" c="dimmed">
        Choose the saved files to attach. Additional uploads remain available below.
      </Text>
      {query.isPending && <Text size="sm">Loading saved documents…</Text>}
      {(query.isError || error) && (
        <Alert color="red">
          {error || 'Could not load saved documents.'}
          <Button
            type="button"
            variant="subtle"
            onClick={() => {
              setError('');
              void query.refetch();
            }}
          >
            Retry
          </Button>
        </Alert>
      )}
      {kind === 'PREARRIVAL' && prearrival.data?.files.map(fileRow)}
      {kind === 'PREARRIVAL' && prearrival.data?.files.length === 0 && (
        <Text size="sm">
          No terminal materials are registered. Upload approved files under Master Data → Ports →
          Terminal pre-arrival documents.
        </Text>
      )}
      {kind === 'ETA_RECAP' && recap.data?.length === 0 && (
        <Text size="sm">
          No sent ETA or NOR records are saved for this nomination. Older external documents can be
          uploaded below.
        </Text>
      )}
      {kind === 'ETA_RECAP' &&
        recap.data?.map((record) => {
          const key = `${record.source}:${record.id}`;
          const file = generated[key];
          return (
            <Stack
              key={key}
              gap={4}
              p="xs"
              style={{ border: '1px solid var(--mantine-color-gray-3)' }}
            >
              <Text size="sm">
                {record.type} · {record.sentAt.slice(0, 16).replace('T', ' ')} UTC ·{' '}
                {record.subject}
              </Text>
              {file ? (
                fileRow(file)
              ) : record.canCreatePdf ? (
                <Button
                  type="button"
                  size="compact-sm"
                  variant="light"
                  disabled={busy}
                  onClick={() => void addRecord(record)}
                >
                  Attach saved message PDF
                </Button>
              ) : (
                <Text size="sm" c="orange">
                  Historical message body/PDF unavailable.
                </Text>
              )}
              {record.attachments.map(fileRow)}
            </Stack>
          );
        })}
    </Stack>
  );
}
