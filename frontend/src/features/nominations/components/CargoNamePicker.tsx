import { Autocomplete } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cargoesApi } from '../../../lib/api/master-data/cargoes';

interface CargoNamePickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function CargoNamePicker({
  label,
  placeholder,
  value = '',
  onChange,
  error,
  disabled,
  style,
}: CargoNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['cargoes', 'search', search],
    queryFn: () => cargoesApi.search(search),
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
      style={style}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
