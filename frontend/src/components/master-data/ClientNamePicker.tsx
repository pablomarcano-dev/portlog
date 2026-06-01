import { Autocomplete, type AutocompleteProps } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { clientsApi } from '../../lib/api/master-data/clients';

interface ClientNamePickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  size?: string;
  rightSection?: AutocompleteProps['rightSection'];
}

/**
 * Free-text field with client name suggestions fetched from the clients search endpoint.
 * Stores the name string (not an ID), compatible with string schema fields.
 */
export function ClientNamePicker({
  label,
  placeholder,
  value = '',
  onChange,
  error,
  disabled,
  size,
  rightSection,
}: ClientNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['clients', 'search', search],
    queryFn: () => clientsApi.search(search),
    enabled: search.length > 0,
    staleTime: 30_000,
  });

  const suggestions = (data ?? []).map((c) => c.label);

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(val) => {
        setSearch(val);
        onChange(val);
      }}
      data={suggestions}
      disabled={disabled}
      error={error}
      size={size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | undefined}
      rightSection={rightSection}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
