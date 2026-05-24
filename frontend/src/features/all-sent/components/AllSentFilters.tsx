import { Group, Anchor } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { useState } from 'react';
import { EntityPicker } from '../../../components/master-data/EntityPicker';

interface AllSentFiltersProps {
  from: Date | null;
  to: Date | null;
  portId: string | null;
  onFromChange: (val: Date | null) => void;
  onToChange: (val: Date | null) => void;
  onPortChange: (val: string | null) => void;
  onClear: () => void;
}

export function AllSentFilters({
  from,
  to,
  portId,
  onFromChange,
  onToChange,
  onPortChange,
  onClear,
}: AllSentFiltersProps) {
  const [portSearch, setPortSearch] = useState('');

  function handlePortChange(val: string | null) {
    onPortChange(val);
    if (!val) setPortSearch('');
  }

  return (
    <Group align="flex-end" wrap="wrap" gap="sm">
      <DatePickerInput
        label="From"
        value={from}
        onChange={onFromChange}
        clearable
        placeholder="Any"
        w={150}
      />
      <DatePickerInput
        label="To"
        value={to}
        onChange={onToChange}
        clearable
        placeholder="Any"
        w={150}
      />
      <EntityPicker
        endpoint="/master-data/ports"
        label="Port"
        value={portId}
        onChange={handlePortChange}
        searchValue={portSearch}
        onSearchChange={setPortSearch}
        placeholder="All ports"
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
  );
}
