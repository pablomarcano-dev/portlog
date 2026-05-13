import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';
import type { NominationUpdateInput } from '@portlog/schemas';
import { nominationsApi } from '../api';

export function useUpdateNomination(id: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: NominationUpdateInput) => nominationsApi.update(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['nominations', id] });
      void qc.invalidateQueries({ queryKey: ['nominations', 'list'] });
      notifications.show({
        title: 'Nomination saved',
        message: 'Changes have been saved successfully.',
        color: 'green',
      });
    },
  });
}
