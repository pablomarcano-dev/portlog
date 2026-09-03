import { useState } from 'react';
import { Alert, Button, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { nominationsApi } from '../api';

interface NominationInstructionsActionProps {
  nominationId: string;
  client: { id: string; name: string } | null;
}

export function NominationInstructionsAction({
  nominationId,
  client,
}: NominationInstructionsActionProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleOpen() {
    if (!client) return;
    const preview = window.open('', '_blank');
    setIsGenerating(true);
    try {
      const blob = await nominationsApi.nominationInstructionsPdf(nominationId);
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
      {!client ? (
        <Alert color="blue" variant="light" p="xs">
          Select a Client in Nomination Details to enable this document.
        </Alert>
      ) : (
        <>
          <Text size="xs" c="dimmed">
            Client: {client.name}
          </Text>
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
