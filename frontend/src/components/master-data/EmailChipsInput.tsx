import { useState } from 'react';
import { TagsInput, Text, Stack } from '@mantine/core';
import { parseEmailList } from '@portlog/schemas';
import { z } from 'zod';

const isEmail = (value: string): boolean => z.string().email().safeParse(value).success;

interface EmailChipsInputProps {
  label?: string;
  description?: string;
  placeholder?: string;
  value?: string[];
  onChange: (value: string[]) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Multi-address email field rendered as chips.
 *
 * Replaces the single-address text inputs that reported "Invalid email" whenever a user pasted
 * the comma-separated lists they actually work with (`nuevo sysportlog.pdf`, 22 Jul 2026).
 *
 * Accepts anything `parseEmailList` understands — comma / semicolon / whitespace separated, and
 * `Display Name <addr@host>`. Entries that are not valid addresses are rejected and named, rather
 * than dropped silently, so the user can see exactly what was not accepted.
 */
export function EmailChipsInput({
  label = 'Email',
  description,
  placeholder = 'Type or paste addresses…',
  value = [],
  onChange,
  error,
  disabled,
}: EmailChipsInputProps) {
  const [rejected, setRejected] = useState<string[]>([]);

  function handleChange(next: string[]) {
    const accepted: string[] = [];
    const bad: string[] = [];
    const seen = new Set<string>();

    for (const entry of next) {
      // A single chip can carry a whole pasted blob — expand it before validating.
      const candidates = parseEmailList(entry);
      if (candidates.length === 0) {
        bad.push(entry);
        continue;
      }
      for (const candidate of candidates) {
        if (seen.has(candidate)) continue;
        if (isEmail(candidate)) {
          seen.add(candidate);
          accepted.push(candidate);
        } else {
          bad.push(candidate);
        }
      }
    }

    setRejected(bad);
    onChange(accepted);
  }

  return (
    <Stack gap={4}>
      <TagsInput
        label={label}
        description={description}
        placeholder={value.length === 0 ? placeholder : undefined}
        value={value}
        onChange={handleChange}
        error={error}
        disabled={disabled}
        splitChars={[',', ';', ' ', '\n', '\t']}
        clearable
      />
      {rejected.length > 0 && (
        <Text size="xs" c="orange.7">
          Not a valid address, so not added: {rejected.join(', ')}
        </Text>
      )}
    </Stack>
  );
}
