import { Badge } from '@mantine/core';
import type { NominationStatus } from '@portlog/schemas';

const STATUS_COLORS: Record<NominationStatus, string> = {
  DRAFT: 'gray',
  CONFIRMED: 'blue',
  IN_PROGRESS: 'yellow',
  COMPLETED: 'green',
  CANCELLED: 'red',
};

const STATUS_LABELS: Record<NominationStatus, string> = {
  DRAFT: 'Draft',
  CONFIRMED: 'Confirmed',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

interface NominationStatusBadgeProps {
  status: NominationStatus;
}

export function NominationStatusBadge({ status }: NominationStatusBadgeProps) {
  return (
    <Badge color={STATUS_COLORS[status]} variant="light" size="sm">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
