import { createFileRoute, redirect } from '@tanstack/react-router';
export const Route = createFileRoute('/_protected/master-data/shippers')({
  beforeLoad: () => {
    throw redirect({ to: '/master-data/clients' });
  },
});
