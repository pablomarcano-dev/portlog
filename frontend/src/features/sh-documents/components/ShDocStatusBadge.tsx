import { Badge } from '@mantine/core';
import type { SHDocumentStatus } from '@portlog/schemas';

interface ShDocStatusBadgeProps {
  status: SHDocumentStatus;
}

export function ShDocStatusBadge({ status }: ShDocStatusBadgeProps) {
  switch (status) {
    case 'DRAFT':
      return <Badge color="gray">Borrador</Badge>;
    case 'FINALIZED':
      return <Badge color="yellow">Finalizado</Badge>;
    case 'SENT':
      return <Badge color="green">Enviado</Badge>;
    default:
      return null;
  }
}
