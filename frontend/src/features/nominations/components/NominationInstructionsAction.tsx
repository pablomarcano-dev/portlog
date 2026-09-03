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

  async function handleDownload() {
    if (!client) return;
    setIsGenerating(true);
    try {
      const blob = await nominationsApi.nominationInstructionsDocx(nominationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `nomination-instructions-${nominationId}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
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
          <Button size="xs" variant="light" loading={isGenerating} onClick={handleDownload}>
            Download instruction document
          </Button>
          <Text size="xs" c="dimmed">
            Fills the original SNCA-RG-AGN-001 Word template with the latest nomination and client
            information.
          </Text>
        </>
      )}
    </Stack>
  );
}
