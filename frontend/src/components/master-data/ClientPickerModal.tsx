import { useState } from 'react';
import { Button, Group, Loader, Modal, ScrollArea, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../lib/api/master-data/clients';
import { useColumnResize } from '../table/useColumnResize';
import { ResizableTh } from '../table/ResizableTh';

type ColKey = 'name' | 'email' | 'phone' | 'action';

const INITIAL_WIDTHS: Record<ColKey, number> = {
  name: 200,
  email: 200,
  phone: 140,
  action: 80,
};

interface ClientPickerModalProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (name: string) => void;
}

export function ClientPickerModal({ opened, onClose, onSelect }: ClientPickerModalProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 300);
  const { colWidths, startResize } = useColumnResize<ColKey>(INITIAL_WIDTHS);

  const { data, isLoading } = useQuery({
    queryKey: ['clients', 'list', debouncedSearch],
    queryFn: () => clientsApi.list({ q: debouncedSearch || undefined, limit: 50 }),
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
      size="70vw"
      styles={{
        content: {
          resize: 'both',
          overflow: 'auto',
          width: '100%',
          minWidth: 400,
        },
      }}
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
          <Table
            striped
            withTableBorder
            withColumnBorders
            highlightOnHover
            style={{ tableLayout: 'fixed', width: 'max-content', minWidth: '100%' }}
          >
            <Table.Thead>
              <Table.Tr>
                <ResizableTh width={colWidths.name} onResize={(e) => startResize('name', e)}>
                  Name
                </ResizableTh>
                <ResizableTh width={colWidths.email} onResize={(e) => startResize('email', e)}>
                  Email
                </ResizableTh>
                <ResizableTh width={colWidths.phone} onResize={(e) => startResize('phone', e)}>
                  Phone
                </ResizableTh>
                <ResizableTh width={colWidths.action} onResize={(e) => startResize('action', e)} />
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {clients.map((c) => (
                <Table.Tr
                  key={c.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleSelect(c.name)}
                >
                  <Table.Td style={{ width: colWidths.name }}>{c.name}</Table.Td>
                  <Table.Td style={{ width: colWidths.email }}>
                    <Text size="xs" c="dimmed">
                      {c.email ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.phone }}>
                    <Text size="xs" c="dimmed">
                      {c.phone ?? c.mobile ?? '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td style={{ width: colWidths.action }}>
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
