import { Autocomplete, type AutocompleteProps } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ContactRole } from '@portlog/schemas';
import { clientsApi } from '../../lib/api/master-data/clients';
import { contactsApi } from '../../lib/api/master-data/contacts';
import { shippersApi } from '../../lib/api/master-data/shippers';

interface ClientNamePickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  /**
   * `entityId` is the id of the master-data record the typed name matches, or
   * null when it matches none. Only meaningful with `entity` set; callers that
   * store the name alone can ignore the second argument.
   */
  onChange: (val: string, entityId?: string | null) => void;
  error?: string;
  disabled?: boolean;
  size?: string;
  rightSection?: AutocompleteProps['rightSection'];
  /**
   * When set, suggestions come from the contacts directory scoped to that role
   * instead of the generic clients search. Ignored when `entity` is set.
   */
  role?: ContactRole;
  /**
   * When set, suggestions are companies from that master-data directory and the
   * picked record's id is reported through `onChange`. Used where the row needs
   * a real FK — a Shipper row must resolve its addresses, which a name cannot.
   */
  entity?: 'shipper';
  onBlur?: () => void;
}

const SUGGESTION_LIMIT = 20;

/** A name suggestion; `id` is set only for directories that carry a real FK. */
interface Suggestion {
  id: string | null;
  label: string;
}

/**
 * Free-text field with name suggestions. With `entity`, suggestions are companies
 * from that directory and the match's id is reported alongside the name; with
 * `role`, they are the contacts cross-linked to that role; with neither, they come
 * from the clients search endpoint. The field itself always stores the name string,
 * so it stays compatible with string schema fields.
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
  entity,
  onBlur,
}: ClientNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery<Suggestion[]>({
    queryKey: entity
      ? [entity, 'search', search]
      : role
        ? ['contacts', 'by-role', role, search]
        : ['clients', 'search', search],
    queryFn: () =>
      entity === 'shipper'
        ? shippersApi.search(search)
        : role
          ? contactsApi
              .list({ q: search, role, limit: SUGGESTION_LIMIT })
              .then((res) => res.items.map((c) => ({ id: null, label: c.label })))
          : clientsApi
              .search(search)
              .then((items) => items.map((c) => ({ id: null, label: c.label }))),
    // Entity and role suggestions are bounded sets, so show them before the user types.
    enabled: entity != null || role != null || search.length > 0,
    staleTime: 30_000,
  });

  const suggestions = (data ?? []).map((c) => c.label);

  /** The directory record the typed name names exactly, if any. */
  function matchedId(val: string): string | null {
    const needle = val.trim().toLowerCase();
    if (needle === '') return null;
    return (data ?? []).find((c) => c.label.trim().toLowerCase() === needle)?.id ?? null;
  }

  return (
    <Autocomplete
      label={label}
      placeholder={placeholder}
      value={value}
      onChange={(val) => {
        setSearch(val);
        onChange(val, matchedId(val));
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
