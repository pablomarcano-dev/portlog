import { NominationInstructionsPreviewButton } from './NominationInstructionsPreviewButton';
import { useEffect, useState } from 'react';
import { Alert, Button, Divider, Group, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import { nominationsApi } from '../api';
import { NewClientModal } from './NewClientModal';
import { AdministrativeNominationInstructionsAction } from './AdministrativeNominationInstructionsAction';

interface NominationInstructionsActionProps {
  nominationId: string;
  reference: string;
  nominationSavePending: boolean;
  client: { id: string; name: string } | null;
  disabled?: boolean;
}

export function NominationInstructionsAction({
  nominationId,
  reference,
  nominationSavePending,
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
      const effectiveClient = nomination.client ?? nomination.charterer;
      setSelectedClient(effectiveClient);
      void queryClient.invalidateQueries({ queryKey: ['nominations', nominationId] });
      void queryClient.invalidateQueries({ queryKey: ['nominations', 'list'] });
      notifications.show({
        title: 'Instruction client saved',
        message: effectiveClient
          ? `${effectiveClient.name} will be used for this document.`
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
      <AdministrativeNominationInstructionsAction
        nominationId={nominationId}
        reference={reference}
        disabled={disabled}
        settingsPending={nominationSavePending || associateClient.isPending}
      />
      <Divider my="xs" />
      <Tooltip
        label="Uses this nomination and the selected instruction client."
        events={{ hover: true, focus: true, touch: true }}
        multiline
        w={240}
      >
        <Text component="span" tabIndex={0} fw={600} size="sm">
          Nomination Instructions Operativo
        </Text>
      </Tooltip>
      <Text size="xs" c="dimmed">
        SNCA-RG-AGN-001
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
          <NominationInstructionsPreviewButton
            nominationId={nominationId}
            kind="operational"
            disabled={nominationSavePending || associateClient.isPending}
          />
          <Button
            size="xs"
            variant="light"
            loading={isGenerating}
            disabled={associateClient.isPending}
            onClick={handleDownload}
          >
            Download instruction document
          </Button>
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
