import { useState } from 'react';
import { Button, Group, Loader, Modal, ScrollArea, Table, Text, TextInput } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../lib/api/master-data/clients';

interface ClientPickerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export function ClientPickerModal({ opened, onClose, onSelect }: ClientPickerModalProps) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['clients', 'list', search],
    queryFn: () => clientsApi.list({ q: search || undefined, limit: 50 }),
    staleTime: 30_000,
    enabled: opened,
  });

  const clients = data?.items ?? [];

  function handleSelect(name: string) {
    onSelect(name);
    onClose();
    setSearch('');
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        onClose();
        setSearch('');
      }}
      title="Select client"
      size="lg"
    >
      <TextInput
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="sm"
        autoFocus
      />

      {isLoading && (
        <Group justify="center" py="md">
          <Loader size="sm" />
        </Group>
      )}

      {!isLoading && clients.length === 0 && (
        <Text size="sm" c="dimmed" ta="center" py="md">
          No clients found.
        </Text>
      )}

      {clients.length > 0 && (
        <ScrollArea h={380}>
          <Table striped withTableBorder withColumnBorders highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Email</Table.Th>
                <Table.Th>Phone</Table.Th>
                <Table.Th style={{ width: 80 }} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clients.map((c) => (
                <Table.Tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelect(c.name)}
                >
                  <Table.Td>{c.name}</Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {c.email ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {c.phone ?? c.mobile ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(c.name);
                      }}
                    >
                      Select
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Modal>
  );
}
