import { createFileRoute } from '@tanstack/react-router';
import { Stack, Title, Alert, Button, Text, Group } from '@mantine/core';
import { useState } from 'react';
import { useAllSent } from '../../features/all-sent/api';
import { AllSentGrid } from '../../features/all-sent/components/AllSentGrid';
import { AllSentFilters } from '../../features/all-sent/components/AllSentFilters';
import { Legend } from '../../features/all-sent/components/Legend';

export const Route = createFileRoute('/_protected/all-sent')({
  component: AllSentPage,
});

function AllSentPage() {
  // Default filter: last 30 days
  const [from, setFrom] = useState<Date | null>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  });
  const [to, setTo] = useState<Date | null>(null);
  const [portId, setPortId] = useState<string | null>(null);

  const filters = {
    from: from?.toISOString(),
    to: to?.toISOString(),
    portId: portId ?? undefined,
  };

  const { data, isLoading, isError, refetch } = useAllSent(filters);

  function handleClear() {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    setFrom(d);
    setTo(null);
    setPortId(null);
  }

  return (
    <Stack p="xl" gap="md">
      <Group justify="space-between" align="center">
        <Title order={2}>All Sent</Title>
      </Group>

      <AllSentFilters
        from={from}
        to={to}
        portId={portId}
        onFromChange={setFrom}
        onToChange={setTo}
        onPortChange={setPortId}
        onClear={handleClear}
      />

      <Legend />

      {isError && (
        <Alert color="red" title="Failed to load data" withCloseButton={false}>
          <Group gap="sm">
            <Text size="sm">Something went wrong. Please try again.</Text>
            <Button variant="subtle" size="xs" color="red" onClick={() => void refetch()}>
              Retry
            </Button>
          </Group>
        </Alert>
      )}

      {isLoading ? <Text c="dimmed">Loading...</Text> : <AllSentGrid rows={data?.rows ?? []} />}
    </Stack>
  );
}
