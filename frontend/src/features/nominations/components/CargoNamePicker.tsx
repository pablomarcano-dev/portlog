import { Autocomplete } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
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

  const resolved = useRef<string | null>(null);
  const onResolved = useRef(onCargoSelect);
  onResolved.current = onCargoSelect;
  useEffect(() => {
    const match = (data ?? []).find((c) => c.label === value);
    if (!match) {
      resolved.current = null;
      return;
    }
    const key = `${value}:${match.bblUnit}`;
    if (resolved.current !== key) {
      resolved.current = key;
      onResolved.current?.(match);
    }
  }, [data, value]);

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
      size={size}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
