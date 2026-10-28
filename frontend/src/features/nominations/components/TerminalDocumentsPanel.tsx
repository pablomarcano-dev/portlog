import { useState } from 'react';
import { Alert, Button, FileButton, Group, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { uploadAttachment } from '../../../lib/api/attachments';
import { AttachmentPreviewButton } from '../../../components/master-data/AttachmentPreviewButton';
import { terminalFiles, fileAtTerminal, retireTerminalFile } from '../api/nominationFiles';

export function TerminalDocumentsPanel({ portId }: { portId: string }) {
  const query = useQuery({
    queryKey: ['terminal-documents', portId],
    queryFn: () => terminalFiles(portId),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function upload(file: File | null) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const stored = await uploadAttachment(file);
      await fileAtTerminal(portId, stored.id);
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  }
  async function retire(id: string) {
    setBusy(true);
    setError('');
    try {
      await retireTerminalFile(portId, id);
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not retire document');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap="xs">
      <Text fw={600}>Terminal pre-arrival documents</Text>
      <Text size="sm" c="dimmed">
        Upload the approved documents for this terminal. Agents select files before sending.
        Retiring a file preserves it and previously sent copies.
      </Text>
      {query.isPending && <Text size="sm">Loading terminal documents…</Text>}
      {(query.isError || error) && (
        <Alert color="red">
          {error || 'Could not load documents.'}
          <Button type="button" variant="subtle" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </Alert>
      )}
      {query.data?.length === 0 && (
        <Text size="sm">No approved documents uploaded for this terminal.</Text>
      )}
      {query.data?.map((file) => (
        <Group key={file.id} justify="space-between">
          <Text size="sm">{file.filename}</Text>
          <Group>
            <AttachmentPreviewButton attachment={file} onPreviewOpenChange={() => undefined} />
            <Button
              type="button"
              size="compact-xs"
              color="orange"
              disabled={busy}
              onClick={() => void retire(file.id)}
            >
              Retire
            </Button>
          </Group>
        </Group>
      ))}
      <FileButton onChange={(file) => void upload(file)}>
        {(props) => (
          <Button {...props} type="button" loading={busy}>
            Upload terminal document
          </Button>
        )}
      </FileButton>
    </Stack>
  );
}
