import { createFileRoute, Outlet } from '@tanstack/react-router';
import { Box, Stack } from '@mantine/core';
import { MasterDataTabs } from '../../components/master-data/MasterDataTabs';

export const Route = createFileRoute('/_protected/master-data')({
  component: MasterDataLayout,
});

function MasterDataLayout() {
  return (
    <Stack gap={0} h="calc(100vh - 56px)">
      <Box style={{ flexShrink: 0 }}>
        <MasterDataTabs />
      </Box>
      <Box style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <Outlet />
      </Box>
    </Stack>
  );
}
