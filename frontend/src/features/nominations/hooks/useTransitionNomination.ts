import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { NominationStatusTransition } from '@portlog/schemas';
import { nominationsApi } from '../api';

export function useTransitionNomination(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: NominationStatusTransition) => nominationsApi.transition(id, body),
    onSuccess: (nomination) => {
      void qc.invalidateQueries({ queryKey: ['nominations', id] });
      void qc.invalidateQueries({ queryKey: ['nominations', 'list'] });
      notifications.show({
        title: 'Status updated',
        message: `Nomination is now ${nomination.status}.`,
        color: 'blue',
      });
    },
  });
}
