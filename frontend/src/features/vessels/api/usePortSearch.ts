import { useState, useEffect } from 'react';
import { useDatalastic } from './useDatalastic';
import type { PortResult } from '@portlog/schemas';

interface PortFindResponse {
  data: PortResult[];
}

/**
 * Debounced port fuzzy-search via the Datalastic port_find endpoint.
 * Only fires when query.length >= 2. Debounce: 300 ms.
 */
export function usePortSearch(query: string): PortResult[] {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const enabled = debouncedQuery.length >= 2;

  const { data } = useDatalastic<PortFindResponse>(
    'port_find',
    { name: debouncedQuery },
    { enabled },
  );

  return data?.data ?? [];
}
