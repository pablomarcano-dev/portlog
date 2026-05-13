import { Timeline, Text, Badge } from '@mantine/core';
import type { NominationStatusHistoryItem } from '@portlog/schemas';

interface StatusHistoryTimelineProps {
  history: NominationStatusHistoryItem[];
}

function formatDate(date: Date): string {
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  });
}

export function StatusHistoryTimeline({ history }: StatusHistoryTimelineProps) {
  // newest first
  const sorted = [...history].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  if (sorted.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        No status history yet.
      </Text>
    );
  }

  return (
    <Timeline active={sorted.length - 1} bulletSize={14} lineWidth={2}>
      {sorted.map((item) => (
        <Timeline.Item
          key={item.id}
          title={
            <Text size="sm" fw={600}>
              {item.fromStatus != null ? `${item.fromStatus} → ` : ''}
              <Badge size="xs" variant="light">
                {item.toStatus}
              </Badge>
            </Text>
          }
        >
          <Text size="xs" c="dimmed">
            {item.changedBy.email}
          </Text>
          <Text size="xs" c="dimmed">
            {formatDate(item.createdAt)}
          </Text>
          {item.reason != null && (
            <Text size="xs" mt={2} fs="italic">
              {item.reason}
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}
