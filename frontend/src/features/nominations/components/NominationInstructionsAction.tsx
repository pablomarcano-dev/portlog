import { useEffect, useState } from 'react';
import { Alert, Button, Group, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { nominationsApi } from '../api';
import { NewClientModal } from './NewClientModal';

interface NominationInstructionsActionProps {
  nominationId: string;
  client: { id: string; name: string } | null;
  disabled?: boolean;
}

export function NominationInstructionsAction({
  nominationId,
  client,
  disabled = false,
}: NominationInstructionsActionProps) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(client);

  useEffect(() => {
    setSelectedClient(client);
  }, [client]);

  const associateClient = useMutation({
    mutationFn: (nextClient: { id: string; name: string } | null) =>
      nominationsApi.update(nominationId, { clientId: nextClient?.id ?? null }),
    onSuccess: (nomination) => {
      setSelectedClient(nomination.client);
      void queryClient.invalidateQueries({ queryKey: ['nominations', nominationId] });
      void queryClient.invalidateQueries({ queryKey: ['nominations', 'list'] });
      notifications.show({
        title: 'Instruction client saved',
        message: nomination.client
          ? `${nomination.client.name} will be used for this document.`
          : 'The instruction client was removed.',
        color: 'green',
      });
    },
    onError: (error) => {
      setSelectedClient(client);
      notifications.show({
        title: 'Could not save instruction client',
        message: error instanceof Error ? error.message : 'Please try again.',
        color: 'red',
      });
    },
  });

  function handleClientChange(id: string | null, name?: string) {
    if (id === selectedClient?.id) return;
    const nextClient = id ? { id, name: name ?? id } : null;
    setSelectedClient(nextClient);
    associateClient.mutate(nextClient);
  }

  async function handleDownload() {
    if (!selectedClient || associateClient.isPending) return;
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
      <Text size="xs" c="dimmed">
        Choose the client whose contacts, message groups and standing instructions belong in this
        document. Clients of every entity type are available.
      </Text>
      <Group align="flex-end" wrap="nowrap">
        <div style={{ flex: 1 }}>
          <EntityPicker
            endpoint="/master-data/clients"
            label="Instruction client"
            placeholder="Search clients..."
            value={selectedClient?.id ?? null}
            selectedOption={
              selectedClient ? { value: selectedClient.id, label: selectedClient.name } : null
            }
            searchValue={clientSearch}
            onSearchChange={setClientSearch}
            onChange={handleClientChange}
            disabled={disabled || associateClient.isPending}
          />
        </div>
        <Button
          variant="default"
          onClick={() => setNewClientOpen(true)}
          disabled={disabled || associateClient.isPending}
        >
          Add client
        </Button>
      </Group>
      {!selectedClient ? (
        <Alert color="blue" variant="light" p="xs">
          Select an instruction client to enable this document.
        </Alert>
      ) : (
        <>
          <Button
            size="xs"
            variant="light"
            loading={isGenerating}
            disabled={associateClient.isPending}
            onClick={handleDownload}
          >
            Download instruction document
          </Button>
          <Text size="xs" c="dimmed">
            Fills the original SNCA-RG-AGN-001 Word template with the latest nomination and client
            information.
          </Text>
        </>
      )}
      <NewClientModal
        opened={newClientOpen}
        onClose={() => setNewClientOpen(false)}
        onCreated={(newClient) => handleClientChange(newClient.id, newClient.name)}
      />
    </Stack>
  );
}
