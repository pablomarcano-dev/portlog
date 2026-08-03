import { useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';

/**
 * A 24-hour time field.
 *
 * Mantine's `TimeInput` renders a native `<input type="time">`, and a native
 * time input displays in the *browser's* locale — under es-VE 16:00 reads back
 * as "04:00 p. m.". Port documents are legally binding and AM/PM on them is
 * ambiguous, so the time is typed and displayed as `HH:mm` regardless of
 * locale (see `lib/format/datetime.ts`).
 *
 * The bound value stays `"HH:mm"` (or `""` when blank) — the same shape the
 * native input produced, so stored data needs no migration.
 */

interface TimeInput24Props extends Omit<TextInputProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Normalises whatever was typed into `HH:mm`, accepting the shorthands people
 * actually use: "7" -> 07:00, "730" -> 07:30, "1630"/"16:30" -> 16:30.
 *
 * An out-of-range time clears the field rather than being clamped: silently
 * turning a mistyped "2530" into 23:59 would put a wrong timestamp on a
 * statement of facts, whereas an empty box is unmistakable.
 */
export function normalizeTime24(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, 4);
  if (digits === '') return '';

  let hours: number;
  let minutes: number;
  if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else {
    hours = Number(digits.slice(0, digits.length - 2));
    minutes = Number(digits.slice(-2));
  }

  if (hours > 23 || minutes > 59) return '';
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function TimeInput24({ value, onChange, onBlur, ...props }: TimeInput24Props) {
  // Kept as typed while the field has focus so half-entered times ("16", "16:")
  // are not normalised out from under the caret; committed on blur.
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <TextInput
      {...props}
      value={draft}
      placeholder={props.placeholder ?? 'HH:MM'}
      maxLength={5}
      inputMode="numeric"
      onChange={(event) => setDraft(event.currentTarget.value.replace(/[^\d:]/g, ''))}
      onBlur={(event) => {
        const normalized = normalizeTime24(draft);
        setDraft(normalized);
        if (normalized !== value) onChange(normalized);
        onBlur?.(event);
      }}
    />
  );
}
