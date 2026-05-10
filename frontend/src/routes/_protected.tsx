import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { AppShell } from '../components/AppShell';
import { accessTokenStore } from '../lib/auth/accessTokenStore';
import { attemptSilentRefresh } from '../lib/auth/queries';

export const Route = createFileRoute('/_protected')({
  async beforeLoad({ location }) {
    if (accessTokenStore.get() === null) {
      await attemptSilentRefresh();
    }
    if (accessTokenStore.get() === null) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
      });
    }
  },
  component: ProtectedLayout,
});

function ProtectedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
