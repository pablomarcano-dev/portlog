import { queryOptions, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { SofTimesheetInput } from '@portlog/schemas';
import { nominationsApi } from '../api';

export const nominationSofQueryOptions = (nominationId: string) =>
  queryOptions({
    queryKey: ['nominations', nominationId, 'sof'],
    queryFn: () => nominationsApi.getSof(nominationId),
    staleTime: 30_000,
    enabled: Boolean(nominationId),
  });

export function useNominationSof(nominationId: string) {
  return useQuery(nominationSofQueryOptions(nominationId));
}

export function useNominationSofSave(nominationId: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: SofTimesheetInput) => nominationsApi.saveSof(nominationId, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nominations', nominationId, 'sof'] });
      notifications.show({
        title: 'Saved',
        message: 'Statement of Facts saved successfully.',
        color: 'green',
      });
    },
    onError: () => {
      notifications.show({
        title: 'Error',
        message: 'Failed to save Statement of Facts.',
        color: 'red',
      });
    },
  });
}
