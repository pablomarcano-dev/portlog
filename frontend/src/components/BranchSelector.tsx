import { Select, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useNavigate } from '@tanstack/react-router';
import { hasManagementAccess, type CurrentUser } from '@portlog/schemas';
import { useSwitchBranch } from '../lib/auth/queries';

export function BranchSelector({ user }: { user: CurrentUser }) {
  const switchBranch = useSwitchBranch();
  const navigate = useNavigate();
  const branches = user.branches ?? [];
  const national = hasManagementAccess(user);
  if (!national && branches.length < 2)
    return <Text size="sm">{user.branchCode ?? 'No branch assigned'}</Text>;
  const options = [
    ...(national ? [{ value: 'national', label: 'All branches' }] : []),
    ...branches.map((branch) => ({ value: branch.id, label: `${branch.code} — ${branch.name}` })),
  ];
  return (
    <Select
      aria-label="Current branch"
      placeholder="Select branch"
      w={220}
      size="xs"
      data={options}
      value={user.branchId ?? 'national'}
      disabled={switchBranch.isPending}
      allowDeselect={false}
      onChange={(value) => {
        if (!value) return;
        void switchBranch
          .mutateAsync(value === 'national' ? null : value)
          .then(() => navigate({ to: '/nominations', search: { page: 1, pageSize: 20 } }))
          .catch(() => {
            notifications.show({
              message: 'Branch could not be changed. Your current branch is unchanged.',
              color: 'red',
            });
          });
      }}
    />
  );
}
