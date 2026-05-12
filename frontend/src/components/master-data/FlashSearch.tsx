import { useState, useEffect, useRef } from 'react';
import { TextInput, Stack, Box, Text, Paper, Loader } from '@mantine/core';

export interface FlashSearchResult {
  id: string;
  label: string;
}

export interface FlashSearchProps {
  searchFn: (query: string) => Promise<FlashSearchResult[]>;
  onSelect: (id: string) => void;
  selectedId: string | null;
  placeholder?: string;
}

/**
 * Flash Search side panel component.
 * Debounces user input by 300ms, calls searchFn, and renders a scrollable
 * result list. Selecting an item calls onSelect with the item id.
 */
export function FlashSearch({
  searchFn,
  onSelect,
  selectedId,
  placeholder = 'Search...',
}: FlashSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FlashSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }

    if (query.trim() === '') {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    debounceRef.current = setTimeout(() => {
      searchFn(query)
        .then((res) => {
          setResults(res);
        })
        .catch(() => {
          setResults([]);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }, 300);

    return () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchFn]);

  return (
    <Stack gap="xs">
      <TextInput
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.currentTarget.value)}
        rightSection={isLoading ? <Loader size="xs" /> : null}
        aria-label="Flash Search"
      />
      {results.length > 0 && (
        <Paper withBorder mah={280} style={{ overflowY: 'auto' }}>
          <Stack gap={0}>
            {results.map((item) => (
              <Box
                key={item.id}
                px="sm"
                py="xs"
                style={{
                  cursor: 'pointer',
                  backgroundColor:
                    item.id === selectedId ? 'var(--mantine-color-blue-1)' : undefined,
                }}
                onClick={() => onSelect(item.id)}
              >
                <Text size="sm">{item.label}</Text>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}
      {!isLoading && query.trim() !== '' && results.length === 0 && (
        <Text size="sm" c="dimmed">
          No results found.
        </Text>
      )}
    </Stack>
  );
}
