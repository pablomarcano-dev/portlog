import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Stack } from '@mantine/core';
import { MasterDataTabs } from '../../components/master-data/MasterDataTabs';

export const Route = createFileRoute('/_protected/master-data')({
  component: MasterDataLayout,
});

/**
 * Layout route for all master-data screens.
 * Renders the 10-tab strip at the top and delegates child content via <Outlet />.
 */
function MasterDataLayout() {
  return (
    <Stack gap={0} h="calc(100vh - 56px)">
      <MasterDataTabs />
      <Outlet />
    </Stack>
  );
}
