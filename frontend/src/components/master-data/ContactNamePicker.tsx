import { Autocomplete } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api/client';

interface ContactNamePickerProps {
  label: string;
  placeholder?: string;
  value?: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Free-text field with contact-name suggestions fetched from the contacts search endpoint.
 * Stores the name string (not an ID), so it's compatible with string schema fields.
 */
export function ContactNamePicker({
  label,
  placeholder,
  value = '',
  onChange,
  error,
  disabled,
}: ContactNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['contacts', 'search', search],
    queryFn: () =>
      apiRequest<Array<{ id: string; label: string }>>(
        `/master-data/contacts/search?q=${encodeURIComponent(search)}`,
      ),
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
      comboboxProps={{ withinPortal: true }}
    />
  );
}
