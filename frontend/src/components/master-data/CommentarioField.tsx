import { Textarea } from '@mantine/core';
import { useFormContext } from 'react-hook-form';

/**
 * Wires the `comments` field into the nearest FormProvider context.
 * Must be rendered inside a <FormProvider>. Entity forms must NOT define
 * their own `comments` field — this component owns it across all 12 forms.
 */
export function CommentarioField() {
  const {
    register,
    formState: { errors },
  } = useFormContext<{ comments?: string | null }>();

  const errorMessage =
    errors.comments?.message != null && typeof errors.comments.message === 'string'
      ? errors.comments.message
      : undefined;

  return (
    <Textarea
      label="Comentarios"
      placeholder="Add comments..."
      minRows={3}
      autosize
      error={errorMessage}
      {...register('comments')}
    />
  );
}
