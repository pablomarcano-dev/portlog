import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { NominationClientCreate, NominationClientUpdate } from '@portlog/schemas';
import { nominationsApi } from '../api';

const clientsQueryKey = (nominationId: string) => ['nominations', nominationId, 'clients'] as const;

export function useNominationClients(nominationId: string) {
  return useQuery({
    queryKey: clientsQueryKey(nominationId),
    queryFn: () => nominationsApi.listClients(nominationId),
    staleTime: 30_000,
  });
}

export function useAddClient(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (data: NominationClientCreate) => nominationsApi.addClient(nominationId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientsQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to add client row.',
        color: 'red',
      });
    },
  });
}

export function useUpdateClient(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: NominationClientUpdate }) =>
      nominationsApi.updateClient(nominationId, clientId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientsQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to update client row.',
        color: 'red',
      });
    },
  });
}

export function useRemoveClient(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => nominationsApi.removeClient(nominationId, clientId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clientsQueryKey(nominationId) });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to remove client row.',
        color: 'red',
      });
    },
  });
}
