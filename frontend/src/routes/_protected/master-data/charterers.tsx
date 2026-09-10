import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_protected/master-data/charterers')({
  beforeLoad: () => {
    throw redirect({ to: '/master-data/clients' });
  },
});
