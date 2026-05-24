import { Group, ThemeIcon, Text } from '@mantine/core';

const LEGEND_ITEMS = [
  { color: 'green', symbol: '✓', label: 'Sent' },
  { color: 'yellow', symbol: '•', label: 'Pending (doc exists)' },
  { color: 'red', symbol: '✗', label: 'Failed' },
  { color: 'gray', symbol: '—', label: 'No document' },
] as const;

export function Legend() {
  return (
    <Group gap="lg" wrap="wrap">
      {LEGEND_ITEMS.map((item) => (
        <Group key={item.label} gap="xs">
          <ThemeIcon
            color={item.color}
            variant={item.color === 'gray' ? 'subtle' : 'light'}
            size="sm"
            radius="xl"
          >
            {item.symbol}
          </ThemeIcon>
          <Text size="xs" c="dimmed">
            {item.label}
          </Text>
        </Group>
      ))}
    </Group>
  );
}
