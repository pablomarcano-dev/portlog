import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Select, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { nominationsApi } from '../api';
import { useNominationClients } from '../hooks/useNominationClients';

interface NominationInstructionsActionProps {
  nominationId: string;
}

export function NominationInstructionsAction({ nominationId }: NominationInstructionsActionProps) {
  const clientsQuery = useNominationClients(nominationId);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const options = useMemo(() => {
    const seen = new Set<string>();
    return (clientsQuery.data ?? [])
      .filter((row): row is typeof row & { clientId: string } => {
        if (!row.clientId || seen.has(row.clientId)) return false;
        seen.add(row.clientId);
        return true;
      })
      .map((row) => ({
        value: row.clientId,
        label: row.type.trim() ? `${row.name} — ${row.type}` : row.name,
      }));
  }, [clientsQuery.data]);

  useEffect(() => {
    if (selectedClientId && options.some((option) => option.value === selectedClientId)) return;
    setSelectedClientId(options[0]?.value ?? null);
  }, [options, selectedClientId]);

  async function handleOpen() {
    if (!selectedClientId) return;
    const preview = window.open('', '_blank');
    setIsGenerating(true);
    try {
      const blob = await nominationsApi.nominationInstructionsPdf(nominationId, selectedClientId);
      const url = URL.createObjectURL(blob);
      if (preview) preview.location.href = url;
      else window.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      preview?.close();
      notifications.show({
        title: 'Could not generate instructions',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'red',
      });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Stack gap="xs" mb="md">
      <Text fw={600} size="sm">
        Nomination instructions
      </Text>
      {options.length === 0 ? (
        <Alert color="blue" variant="light" p="xs">
          Select a client from Master Data in the nomination’s Client List to enable this document.
        </Alert>
      ) : (
        <>
          <Select
            label="Client"
            size="xs"
            value={selectedClientId}
            onChange={setSelectedClientId}
            data={options}
            allowDeselect={false}
          />
          <Button size="xs" variant="light" loading={isGenerating} onClick={handleOpen}>
            Open instruction sheet
          </Button>
          <Text size="xs" c="dimmed">
            Uses the latest nomination facts and the client’s saved contacts, email group, and
            instructions.
          </Text>
        </>
      )}
    </Stack>
  );
}
