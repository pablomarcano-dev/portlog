import { useState } from 'react';
import { Accordion, ActionIcon, Alert, Button, Group, Stack, Text, Textarea } from '@mantine/core';
import { useFleet } from '../lib/fleet';

interface FleetPanelProps {
  unlocode: string | null;
}

export function FleetPanel({ unlocode }: FleetPanelProps) {
  const { entries, addImos, removeImo } = useFleet(unlocode);
  const [bulkInput, setBulkInput] = useState('');
  const [lastResult, setLastResult] = useState<{ added: string[]; invalid: string[] } | null>(null);

  function handleAdd() {
    if (!bulkInput.trim()) return;
    const result = addImos(bulkInput);
    setLastResult(result);
    setBulkInput('');
  }

  return (
    <Accordion variant="contained">
      <Accordion.Item value="fleet">
        <Accordion.Control>
          <Group gap="xs">
            <Text size="sm" fw={500}>
              Fleet Monitor
            </Text>
            {entries.length > 0 && (
              <Text size="xs" c="dimmed">
                ({entries.length} vessel{entries.length !== 1 ? 's' : ''})
              </Text>
            )}
          </Group>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="sm">
            {!unlocode && (
              <Text size="sm" c="dimmed">
                Select a port to manage your fleet.
              </Text>
            )}

            {unlocode && (
              <>
                <Textarea
                  label="Add IMOs"
                  placeholder="Paste one or more 7-digit IMO numbers, separated by spaces or commas…"
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.currentTarget.value)}
                  autosize
                  minRows={2}
                />
                <Button size="sm" onClick={handleAdd} disabled={!bulkInput.trim()}>
                  Add to Fleet
                </Button>

                {lastResult !== null && lastResult.invalid.length > 0 && (
                  <Alert color="orange" title="Invalid IMOs">
                    <Text size="sm">{lastResult.invalid.join(', ')}</Text>
                  </Alert>
                )}

                {entries.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    No vessels in fleet for this port.
                  </Text>
                ) : (
                  <Stack gap={4}>
                    {entries.map((entry) => (
                      <Group key={entry.imo} justify="space-between">
                        <Text size="sm">
                          {entry.name ?? entry.imo}
                          {entry.name && (
                            <Text component="span" size="xs" c="dimmed" ml={4}>
                              ({entry.imo})
                            </Text>
                          )}
                        </Text>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          size="sm"
                          onClick={() => removeImo(entry.imo)}
                          aria-label={`Remove ${entry.imo}`}
                        >
                          ×
                        </ActionIcon>
                      </Group>
                    ))}
                  </Stack>
                )}
              </>
            )}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
