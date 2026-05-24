import { Select } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api/client';

interface EntityItem {
  id: string;
  name?: string;
  // Some entities (e.g. Owner) use a backend-computed `label` field instead of `name`
  label?: string;
}

interface EntityListResponse {
  items: EntityItem[];
}

interface EntityPickerProps {
  endpoint: string;
  label: string;
  value: string | null;
  onChange: (val: string | null) => void;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  required?: boolean;
  error?: string;
  placeholder?: string;
}

/**
 * Reusable searchable Select that fetches a list endpoint with ?q= and maps
 * results to { value: item.id, label: item.name }.
 *
 * Fetches GET {endpoint}?q={searchValue}&limit=50.
 */
export function EntityPicker({
  endpoint,
  label,
  value,
  onChange,
  searchValue = '',
  onSearchChange,
  required,
  error,
  placeholder,
}: EntityPickerProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['entity-picker', endpoint, searchValue],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (searchValue) params.set('q', searchValue);
      return apiRequest<EntityListResponse>(`${endpoint}?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const selectData = (data?.items ?? []).map((item) => ({
    value: item.id,
    label: item.label ?? item.name ?? item.id,
  }));

  return (
    <Select
      label={label}
      placeholder={placeholder ?? `Search ${label}...`}
      required={required}
      error={error}
      value={value}
      onChange={onChange}
      data={selectData}
      searchable
      searchValue={searchValue}
      onSearchChange={onSearchChange}
      disabled={isLoading}
      clearable
      nothingFoundMessage={isLoading ? 'Loading...' : 'No results found'}
    />
  );
}
