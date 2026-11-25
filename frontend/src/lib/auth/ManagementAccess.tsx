import type { ReactNode } from 'react';
import { Alert, Loader } from '@mantine/core';
import { hasManagementAccess } from '@portlog/schemas';
import { useCurrentUser } from './queries';

export function ManagementAccess({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useCurrentUser();
  if (isPending) return <Loader size="sm" />;
  if (!hasManagementAccess(user))
    return <Alert color="yellow">This page is available to Admin and Fleet Manager.</Alert>;
  return <>{children}</>;
}
