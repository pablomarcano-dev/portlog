import { useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';
import { formatQuantity } from '@portlog/schemas';

/**
 * A numeric quantity field for SOF figures — bunker quantities, bill of lading
 * volumes, drafts.
 *
 * Digits only: these cells hold quantities, so nothing else should be typeable
 * into them. While focused it shows the raw number for easy editing, and on
 * blur it shows the grouped form ("1896870" -> "1,896,870"). The *stored* value
 * is always ungrouped, so the figure a document prints is derived from the
 * number rather than from however it happened to be punctuated on screen.
 */

interface QuantityInputProps extends Omit<TextInputProps, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Digits, one decimal point, optional leading minus.
 *
 * A typed comma becomes the decimal point: the agency's figures come off
 * Spanish-locale paperwork where "286433,463" means 286433.463, and silently
 * dropping that comma would multiply the figure by a thousand.
 */
export function sanitizeQuantity(input: string): string {
  const negative = input.trimStart().startsWith('-');
  const [int = '', ...rest] = input
    .replace(/,/g, '.')
    .replace(/[^\d.]/g, '')
    .split('.');
  const decimals = rest.join('');
  const body = rest.length > 0 ? `${int}.${decimals}` : int;
  return negative ? `-${body}` : body;
}

export function QuantityInput({ value, onChange, onFocus, onBlur, ...props }: QuantityInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <TextInput
      {...props}
      value={focused ? draft : formatQuantity(value)}
      inputMode="decimal"
      onFocus={(event) => {
        setDraft(value);
        setFocused(true);
        onFocus?.(event);
      }}
      onChange={(event) => {
        const next = sanitizeQuantity(event.currentTarget.value);
        setDraft(next);
        if (next !== value) onChange(next);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
    />
  );
}
