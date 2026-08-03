import { useEffect, useMemo, useState } from 'react';
import { Select, Loader } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { useDebouncedValue } from '@mantine/hooks';
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
  extraParams?: Record<string, string>;
  disabled?: boolean;
  /**
   * The option `value` refers to, when the caller already knows its label
   * (e.g. from a `{ id, name }` object on the record being edited).
   *
   * The list endpoint returns one page, so a stored id is frequently *not*
   * among the fetched options — and Mantine's Select renders an empty box for
   * a value it cannot look up, which reads as "the field was never saved".
   * Supplying the option here makes the saved value visible without a lookup.
   */
  selectedOption?: { value: string; label: string } | null;
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
  extraParams,
  disabled: disabledProp,
  selectedOption,
}: EntityPickerProps) {
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['entity-picker', endpoint, debouncedSearch, extraParams],
    queryFn: () => {
      const params = new URLSearchParams({ limit: '50' });
      if (debouncedSearch) params.set('q', debouncedSearch);
      if (extraParams) {
        for (const [k, v] of Object.entries(extraParams)) params.set(k, v);
      }
      return apiRequest<EntityListResponse>(`${endpoint}?${params.toString()}`);
    },
    staleTime: 30_000,
  });

  const fetchedOptions = useMemo(
    () =>
      (data?.items ?? []).map((item) => ({
        value: item.id,
        label: item.label ?? item.name ?? item.id,
      })),
    [data],
  );

  // Labels seen in any page fetched so far. Narrowing the search refetches a
  // page that need not contain the current selection, so without this the
  // field would blank out as soon as the user typed a different search.
  const [labelCache, setLabelCache] = useState<Record<string, string>>({});
  useEffect(() => {
    if (fetchedOptions.length === 0) return;
    setLabelCache((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const option of fetchedOptions) {
        if (next[option.value] !== option.label) {
          next[option.value] = option.label;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [fetchedOptions]);

  const selectData = useMemo(() => {
    if (!value || fetchedOptions.some((option) => option.value === value)) return fetchedOptions;
    const known =
      selectedOption?.value === value ? selectedOption.label : (labelCache[value] ?? null);
    return known ? [{ value, label: known }, ...fetchedOptions] : fetchedOptions;
  }, [fetchedOptions, value, selectedOption, labelCache]);

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
      disabled={disabledProp}
      rightSection={isLoading ? <Loader size="xs" /> : undefined}
      clearable
      nothingFoundMessage={isLoading ? 'Loading...' : 'No results found'}
    />
  );
}
