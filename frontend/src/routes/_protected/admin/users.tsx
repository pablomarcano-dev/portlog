import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Box,
  Button,
  Group,
  Text,
  Badge,
  Table,
  ActionIcon,
  Modal,
  Stack,
  TextInput,
  PasswordInput,
  Select,
  Switch,
  Tooltip,
  Center,
  Loader,
  Alert,
  Title,
} from '@mantine/core';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { notifications } from '@mantine/notifications';
import {
  CreateUserSchema,
  UpdateUserSchema,
  ResetPasswordSchema,
  type AdminUser,
  type CreateUserInput,
  type UpdateUserInput,
  type ResetPasswordInput,
} from '@portlog/schemas';
import {
  useAdminUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useResetPassword,
  useSendCredentials,
} from '../../../lib/api/admin/users';
import { useCurrentUser } from '../../../lib/auth/queries';

export const Route = createFileRoute('/_protected/admin/users')({
  component: UsersAdminScreen,
});

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ── Main screen ────────────────────────────────────────────────────────────

function UsersAdminScreen() {
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const { data: users, isPending, isError } = useAdminUsers();

  // Client-side guard — backend enforces this regardless.
  if (currentUser && currentUser.role !== 'ADM') {
    void navigate({ to: '/' });
    return null;
  }

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [resetTarget, setResetTarget] = useState<AdminUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);

  const deleteUser = useDeleteUser();
  const sendCredentials = useSendCredentials();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteUser.mutateAsync(deleteTarget.id);
      notifications.show({ message: 'User deleted.', color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to delete user.', color: 'red' });
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleSendCredentials(user: AdminUser) {
    try {
      await sendCredentials.mutateAsync(user.id);
      notifications.show({ message: `Credentials sent to ${user.email}.`, color: 'green' });
    } catch {
      notifications.show({ message: 'Failed to send credentials.', color: 'red' });
    }
  }

  if (isPending) {
    return (
      <Center h={200}>
        <Loader />
      </Center>
    );
  }

  if (isError) {
    return (
      <Box p="xl">
        <Alert color="red">Failed to load users.</Alert>
      </Box>
    );
  }

  return (
    <Box p="xl">
      <Group justify="space-between" mb="lg">
        <Title order={3}>User Management</Title>
        <Button onClick={() => setCreateOpen(true)}>New User</Button>
      </Group>

      <Table striped highlightOnHover withTableBorder withColumnBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Email</Table.Th>
            <Table.Th>Name</Table.Th>
            <Table.Th>Role</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Last Login</Table.Th>
            <Table.Th style={{ width: 160 }}>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {users?.map((user) => (
            <Table.Tr key={user.id}>
              <Table.Td>
                <Text size="sm">{user.email}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c={user.displayName ? undefined : 'dimmed'}>
                  {user.displayName ?? '—'}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge variant="light" color={user.role === 'ADM' ? 'violet' : 'blue'} size="sm">
                  {user.role}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge variant="dot" color={user.isActive ? 'green' : 'gray'} size="sm">
                  {user.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Text size="sm" c="dimmed">
                  {formatDate(user.lastLoginAt)}
                </Text>
              </Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <Tooltip label="Edit">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => setEditTarget(user)}
                      aria-label="Edit user"
                    >
                      ✏️
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Reset password">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      onClick={() => setResetTarget(user)}
                      aria-label="Reset password"
                    >
                      🔑
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Send credentials by email">
                    <ActionIcon
                      variant="subtle"
                      size="sm"
                      loading={sendCredentials.isPending}
                      onClick={() => void handleSendCredentials(user)}
                      aria-label="Send credentials"
                    >
                      ✉️
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip
                    label={user.id === currentUser?.id ? 'Cannot delete yourself' : 'Delete'}
                  >
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      disabled={user.id === currentUser?.id}
                      onClick={() => setDeleteTarget(user)}
                      aria-label="Delete user"
                    >
                      🗑️
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {/* Create modal */}
      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Edit modal */}
      {editTarget && <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} />}

      {/* Reset password modal */}
      {resetTarget && (
        <ResetPasswordModal user={resetTarget} onClose={() => setResetTarget(null)} />
      )}

      {/* Delete confirm modal */}
      <Modal
        opened={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete user"
        centered
        size="sm"
      >
        <Text size="sm" mb="lg">
          Delete <strong>{deleteTarget?.email}</strong>? This cannot be undone. All active sessions
          will be revoked.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button color="red" loading={deleteUser.isPending} onClick={() => void handleDelete()}>
            Delete
          </Button>
        </Group>
      </Modal>
    </Box>
  );
}

// ── Create modal ───────────────────────────────────────────────────────────

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createUser = useCreateUser();
  const form = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: { email: '', displayName: '', password: '', role: 'OPS' },
  });

  async function onSubmit(values: CreateUserInput) {
    try {
      await createUser.mutateAsync(values);
      notifications.show({ message: 'User created.', color: 'green' });
      form.reset();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create user.';
      notifications.show({
        message: msg.includes('409') ? 'Email already in use.' : msg,
        color: 'red',
      });
    }
  }

  return (
    <Modal opened={open} onClose={onClose} title="New User" centered>
      <form onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
        <Stack gap="sm">
          <TextInput
            label="Email"
            placeholder="user@company.com"
            required
            error={form.formState.errors.email?.message}
            {...form.register('email')}
          />
          <TextInput
            label="Display Name"
            placeholder="Full name"
            error={form.formState.errors.displayName?.message}
            {...form.register('displayName')}
          />
          <PasswordInput
            label="Password"
            placeholder="Min. 8 characters"
            required
            error={form.formState.errors.password?.message}
            {...form.register('password')}
          />
          <Controller
            name="role"
            control={form.control}
            render={({ field }) => (
              <Select
                label="Role"
                required
                data={[
                  { value: 'OPS', label: 'OPS — Operations' },
                  { value: 'ADM', label: 'ADM — Admin' },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v ?? 'OPS')}
                error={form.formState.errors.role?.message}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={createUser.isPending}>
              Create
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Edit modal ─────────────────────────────────────────────────────────────

function EditUserModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const updateUser = useUpdateUser(user.id);
  const form = useForm<UpdateUserInput>({
    resolver: zodResolver(UpdateUserSchema),
    defaultValues: {
      displayName: user.displayName ?? '',
      phone: user.phone ?? '',
      mobile: user.mobile ?? '',
      fax: user.fax ?? '',
      role: user.role,
      isActive: user.isActive,
    },
  });

  async function onSubmit(values: UpdateUserInput) {
    try {
      await updateUser.mutateAsync(values);
      notifications.show({ message: 'User updated.', color: 'green' });
      onClose();
    } catch {
      notifications.show({ message: 'Failed to update user.', color: 'red' });
    }
  }

  return (
    <Modal opened onClose={onClose} title={`Edit — ${user.email}`} centered>
      <form onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
        <Stack gap="sm">
          <TextInput
            label="Display Name"
            placeholder="Full name"
            error={form.formState.errors.displayName?.message}
            {...form.register('displayName')}
          />
          <TextInput
            label="Phone"
            placeholder="+1 555 0100"
            error={form.formState.errors.phone?.message}
            {...form.register('phone')}
          />
          <TextInput
            label="Mobile"
            placeholder="+1 555 0101"
            error={form.formState.errors.mobile?.message}
            {...form.register('mobile')}
          />
          <TextInput
            label="Fax"
            placeholder="+1 555 0102"
            error={form.formState.errors.fax?.message}
            {...form.register('fax')}
          />
          <Controller
            name="role"
            control={form.control}
            render={({ field }) => (
              <Select
                label="Role"
                data={[
                  { value: 'OPS', label: 'OPS — Operations' },
                  { value: 'ADM', label: 'ADM — Admin' },
                ]}
                value={field.value}
                onChange={(v) => field.onChange(v ?? user.role)}
                error={form.formState.errors.role?.message}
              />
            )}
          />
          <Controller
            name="isActive"
            control={form.control}
            render={({ field }) => (
              <Switch
                label="Active"
                checked={field.value ?? true}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={updateUser.isPending}>
              Save
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Reset password modal ───────────────────────────────────────────────────

function ResetPasswordModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const resetPassword = useResetPassword(user.id);
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { newPassword: '' },
  });

  async function onSubmit(values: ResetPasswordInput) {
    try {
      await resetPassword.mutateAsync(values);
      notifications.show({ message: 'Password reset. All sessions revoked.', color: 'green' });
      onClose();
    } catch {
      notifications.show({ message: 'Failed to reset password.', color: 'red' });
    }
  }

  return (
    <Modal opened onClose={onClose} title={`Reset password — ${user.email}`} centered size="sm">
      <form onSubmit={form.handleSubmit((v) => void onSubmit(v))}>
        <Stack gap="sm">
          <Text size="sm" c="dimmed">
            All active sessions for this user will be revoked immediately.
          </Text>
          <PasswordInput
            label="New Password"
            placeholder="Min. 8 characters"
            required
            error={form.formState.errors.newPassword?.message}
            {...form.register('newPassword')}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" color="orange" loading={resetPassword.isPending}>
              Reset Password
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
