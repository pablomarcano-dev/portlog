import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/')({
  component: () => <Navigate to="/nominations" search={{ page: 1, pageSize: 25 }} />,
});
