import { Autocomplete } from '@mantine/core';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CargoCategory } from '@portlog/schemas';
import { cargoesApi, type CargoSuggestion } from '../../../lib/api/master-data/cargoes';

interface CargoNamePickerProps {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange: (val: string) => void;
  error?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  size?: string;
  /** When set, only products in this category are suggested (e.g. "OT" for OT nominations). */
  category?: CargoCategory;
  /**
   * Fired when the typed name resolves to a catalog product, carrying the full
   * record. Callers use it to seed dependent fields (units) from the product.
   */
  onCargoSelect?: (cargo: CargoSuggestion) => void;
}

export function CargoNamePicker({
  label,
  placeholder,
  value = '',
  onChange,
  error,
  disabled,
  style,
  size,
  category,
  onCargoSelect,
}: CargoNamePickerProps) {
  const [search, setSearch] = useState('');

  const { data } = useQuery({
    queryKey: ['cargoes', 'search', search, category ?? 'ALL'],
    queryFn: () => cargoesApi.search(search, category),
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
        // Fires both on option click and on a fully typed-out name — either way
        // the user has landed on a catalog product, so dependent fields can sync.
        const match = (data ?? []).find((c) => c.label === val);
        if (match) onCargoSelect?.(match);
      }}
      data={suggestions}
      disabled={disabled}
      error={error}
      style={style}
      size={size}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
