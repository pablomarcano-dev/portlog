import { Badge } from '@mantine/core';
import type { NominationStatus } from '@portlog/schemas';

const STATUS_COLORS: Record<NominationStatus, string> = {
  NOMINATED: 'blue',
  IN_PORT: 'teal',
  FULL_AWAY: 'green',
  CANCELLED: 'red',
};

const STATUS_LABELS: Record<NominationStatus, string> = {
  NOMINATED: 'Nominated',
  IN_PORT: 'In Port',
  FULL_AWAY: 'Full Away',
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
