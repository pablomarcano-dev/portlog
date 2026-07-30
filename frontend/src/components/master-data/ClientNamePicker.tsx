import { Autocomplete, type AutocompleteProps } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ContactRole } from '@portlog/schemas';
import { clientsApi } from '../../lib/api/master-data/clients';
import { contactsApi } from '../../lib/api/master-data/contacts';

interface ClientNamePickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  size?: string;
  rightSection?: AutocompleteProps['rightSection'];
  /**
   * When set, suggestions come from the contacts directory scoped to that role
   * instead of the generic clients search.
   */
  role?: ContactRole;
  onBlur?: () => void;
}

const SUGGESTION_LIMIT = 20;

/**
 * Free-text field with name suggestions. With `role`, suggestions are the contacts
 * cross-linked to that role; without it, they come from the clients search endpoint.
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
  role,
  onBlur,
}: ClientNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: role ? ['contacts', 'by-role', role, search] : ['clients', 'search', search],
    queryFn: () =>
      role
        ? contactsApi
            .list({ q: search, role, limit: SUGGESTION_LIMIT })
            .then((res) => res.items.map((c) => ({ label: c.label })))
        : clientsApi.search(search).then((items) => items.map((c) => ({ label: c.label }))),
    // Role-scoped contacts are a bounded set, so show them before the user types.
    enabled: role != null || search.length > 0,
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
      onBlur={onBlur}
      data={suggestions}
      disabled={disabled}
      error={error}
      size={size as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | undefined}
      rightSection={rightSection}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
