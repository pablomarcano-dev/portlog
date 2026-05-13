import { Group, Select, TextInput, Anchor, Stack } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useDebouncedValue } from '@mantine/hooks';
import { useState, useEffect } from 'react';
import { EntityPicker } from '../../../components/master-data/EntityPicker';
import type { NominationStatus } from '@portlog/schemas';

const STATUS_OPTIONS: Array<{ value: NominationStatus | ''; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

interface NominationFiltersProps {
  status: NominationStatus | undefined;
  portId: string | undefined;
  shipParticularId: string | undefined;
  dateFrom: Date | undefined;
  dateTo: Date | undefined;
  search: string | undefined;
  onStatusChange: (val: NominationStatus | undefined) => void;
  onPortChange: (val: string | undefined) => void;
  onVesselChange: (val: string | undefined) => void;
  onDateFromChange: (val: Date | undefined) => void;
  onDateToChange: (val: Date | undefined) => void;
  onSearchChange: (val: string | undefined) => void;
  onClear: () => void;
}

export function NominationFilters({
  status,
  portId,
  shipParticularId,
  dateFrom,
  dateTo,
  search,
  onStatusChange,
  onPortChange,
  onVesselChange,
  onDateFromChange,
  onDateToChange,
  onSearchChange,
  onClear,
}: NominationFiltersProps) {
  // Local search state for debouncing
  const [localSearch, setLocalSearch] = useState(search ?? '');
  const [debouncedSearch] = useDebouncedValue(localSearch, 300);

  // Propagate debounced search up
  useEffect(() => {
    onSearchChange(debouncedSearch !== '' ? debouncedSearch : undefined);
  }, [debouncedSearch, onSearchChange]);

  // Sync local search when parent clears filters
  useEffect(() => {
    setLocalSearch(search ?? '');
  }, [search]);

  // EntityPicker search state
  const [portSearch, setPortSearch] = useState('');
  const [vesselSearch, setVesselSearch] = useState('');

  function handleStatusChange(val: string | null) {
    if (!val) {
      onStatusChange(undefined);
    } else {
      onStatusChange(val as NominationStatus);
    }
  }

  function handlePortChange(val: string | null) {
    onPortChange(val ?? undefined);
    if (!val) setPortSearch('');
  }

  function handleVesselChange(val: string | null) {
    onVesselChange(val ?? undefined);
    if (!val) setVesselSearch('');
  }

  return (
    <Stack gap="xs">
      <Group align="flex-end" wrap="wrap" gap="sm">
        <Select
          label="Status"
          value={status ?? ''}
          onChange={handleStatusChange}
          data={STATUS_OPTIONS}
          w={160}
          clearable={false}
        />
        <EntityPicker
          endpoint="/master-data/ports"
          label="Port"
          value={portId ?? null}
          onChange={handlePortChange}
          searchValue={portSearch}
          onSearchChange={setPortSearch}
          placeholder="All ports"
        />
        <EntityPicker
          endpoint="/master-data/ship-particulars"
          label="Vessel"
          value={shipParticularId ?? null}
          onChange={handleVesselChange}
          searchValue={vesselSearch}
          onSearchChange={setVesselSearch}
          placeholder="All vessels"
        />
        <DatePickerInput
          label="Date from"
          value={dateFrom ?? null}
          onChange={(val) => onDateFromChange(val ?? undefined)}
          clearable
          placeholder="Any"
          w={150}
        />
        <DatePickerInput
          label="Date to"
          value={dateTo ?? null}
          onChange={(val) => onDateToChange(val ?? undefined)}
          clearable
          placeholder="Any"
          w={150}
        />
        <TextInput
          label="Search"
          placeholder="Voyage, vessel, SN..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.currentTarget.value)}
          w={200}
        />
        <Anchor
          component="button"
          type="button"
          size="sm"
          c="dimmed"
          onClick={onClear}
          style={{ alignSelf: 'flex-end', paddingBottom: 6 }}
        >
          Clear filters
        </Anchor>
      </Group>
    </Stack>
  );
}
