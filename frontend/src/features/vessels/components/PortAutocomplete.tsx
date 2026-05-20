import { useState } from 'react';
import { Autocomplete, Badge, Group, Paper, Stack, Text } from '@mantine/core';
import type { PortDetail, PortResult } from '@portlog/schemas';
import { usePortSearch } from '../api/usePortSearch';
import { apiRequest } from '../../../lib/api/client';

interface PortAutocompleteProps {
  onPortSelect: (port: PortDetail | null) => void;
  selectedPort: PortDetail | null;
}

export function PortAutocomplete({ onPortSelect, selectedPort }: PortAutocompleteProps) {
  const [query, setQuery] = useState('');
  const results = usePortSearch(query);

  const autocompleteData = results.map((p: PortResult) => ({
    value: p.uuid,
    label: `${p.port_name} (${p.unlocode}) — ${p.country_name}`,
  }));

  async function handleSelect(value: string) {
    const result = results.find((p) => p.uuid === value);
    if (!result) return;
    // Fetch full port detail (with terminals)
    try {
      const detail = await apiRequest<{ data: PortDetail }>(
        `/datalastic/port?unlocode=${result.unlocode}`,
      );
      onPortSelect(detail.data);
      setQuery(`${result.port_name} (${result.unlocode})`);
    } catch {
      // Fallback: treat PortResult as PortDetail (no terminals)
      onPortSelect({ ...result, terminals: [] });
      setQuery(`${result.port_name} (${result.unlocode})`);
    }
  }

  return (
    <Stack gap="sm">
      <Autocomplete
        label="Port"
        placeholder="Search port by name or UNLOCODE…"
        value={query}
        onChange={(v) => {
          setQuery(v);
          if (v === '') onPortSelect(null);
        }}
        data={autocompleteData}
        onOptionSubmit={(value) => void handleSelect(value)}
        limit={10}
        size="md"
      />

      {selectedPort && (
        <Paper withBorder p="xs" radius="sm">
          <Group gap="xs" wrap="wrap">
            <Text size="sm" fw={500}>
              {selectedPort.port_name}
            </Text>
            <Badge variant="outline" size="sm">
              {selectedPort.unlocode}
            </Badge>
            <Text size="xs" c="dimmed">
              {selectedPort.country_name}
            </Text>
            <Text size="xs" c="dimmed">
              {selectedPort.lat.toFixed(4)}, {selectedPort.lon.toFixed(4)}
            </Text>
            {selectedPort.area_lvl1 && (
              <Text size="xs" c="dimmed">
                {selectedPort.area_lvl1}
              </Text>
            )}
          </Group>
        </Paper>
      )}
    </Stack>
  );
}
