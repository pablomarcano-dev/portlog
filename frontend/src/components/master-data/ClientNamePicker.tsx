import { Combobox, TextInput, useCombobox, Text } from '@mantine/core';
import { useState } from 'react';
import { useDebouncedValue } from '@mantine/hooks';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../lib/api/master-data/clients';
import { ownersApi } from '../../lib/api/master-data/owners';
export type ClientDirectory = 'client' | 'owner';
interface Props {
  label?: string;
  placeholder?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  onBlur?: () => void;
  onChange: (name: string, id?: string | null, directory?: ClientDirectory) => void;
}
/** Explicit option IDs preserve company identity even when display names repeat. */
export function ClientNamePicker({ value = '', onChange, onBlur, ...props }: Props) {
  const [search, setSearch] = useState('');
  const box = useCombobox();
  const [query] = useDebouncedValue(search, 200);
  const { data, isFetching, isError } = useQuery({
    queryKey: ['clients', 'party-search', query],
    queryFn: async () => {
      const [clients, owners] = await Promise.all([
        clientsApi.list({ q: query, limit: 50 }),
        ownersApi.search(query),
      ]);
      return [
        ...clients.items.map((c) => ({
          id: c.id,
          name: c.name,
          kind: 'client' as const,
          detail: c.entityType.toLowerCase(),
        })),
        ...owners.map((o) => ({
          id: o.id,
          name: o.label,
          kind: 'owner' as const,
          detail: 'owner',
        })),
      ];
    },
  });
  return (
    <Combobox
      store={box}
      withinPortal
      onOptionSubmit={(key) => {
        const option = data?.find((o) => `${o.kind}:${o.id}` === key);
        if (option) {
          onChange(option.name, option.id, option.kind);
          setSearch('');
        }
        box.closeDropdown();
      }}
    >
      <Combobox.Target>
        <TextInput
          {...props}
          value={value}
          onChange={(e) => {
            setSearch(e.currentTarget.value);
            onChange(e.currentTarget.value, null);
            box.openDropdown();
          }}
          onFocus={() => box.openDropdown()}
          onClick={() => box.openDropdown()}
          onBlur={() => {
            box.closeDropdown();
            onBlur?.();
          }}
        />
      </Combobox.Target>
      <Combobox.Dropdown>
        <Combobox.Options mah={260} style={{ overflowY: 'auto' }}>
          {(data ?? []).map((o) => (
            <Combobox.Option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
              <Text size="sm">{o.name}</Text>
              <Text size="xs" c="dimmed">
                {o.detail} · {o.id.slice(-6)}
              </Text>
            </Combobox.Option>
          ))}
          {isFetching && <Combobox.Empty>Loading companies…</Combobox.Empty>}
          {isError && <Combobox.Empty>Could not load companies. Please retry.</Combobox.Empty>}
          {!isFetching && !isError && !data?.length && (
            <Combobox.Empty>No companies found. You can enter a name manually.</Combobox.Empty>
          )}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  );
}
