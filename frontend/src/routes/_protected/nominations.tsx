import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected/nominations')({
  component: NominationsLayout,
});

function NominationsLayout() {
  return <Outlet />;
}
