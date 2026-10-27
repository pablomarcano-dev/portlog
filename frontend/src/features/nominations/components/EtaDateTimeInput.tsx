import { useEffect, useState } from 'react';
import { Group, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { formatEtaTime, withEtaTime } from '../etaTime';

/** Explicit HH:mm input avoids the locale-dependent AM/PM native time editor. */
export function EtaDateTimeInput({
  label,
  description,
  value,
  onChange,
  onValidityChange,
}: {
  label: string;
  description: string;
  value: Date | null;
  onChange: (value: Date | null) => void;
  onValidityChange: (valid: boolean) => void;
}) {
  const [time, setTime] = useState(() => formatEtaTime(value));
  useEffect(() => setTime(formatEtaTime(value)), [value]);
  const invalid = value !== null && withEtaTime(value, time) === null;
  return (
    <Group align="flex-start" grow style={{ flex: 1 }}>
      <DatePickerInput
        label={label}
        description={description}
        placeholder="Select date"
        valueFormat="DD/MM/YYYY"
        value={value}
        onChange={(date) => {
          if (date && value)
            date.setHours(
              value.getHours(),
              value.getMinutes(),
              value.getSeconds(),
              value.getMilliseconds(),
            );
          onValidityChange(true);
          onChange(date);
        }}
        clearable
      />
      <TextInput
        label={`${label} time`}
        description="24-hour time (HH:mm)"
        placeholder="20:00"
        value={time}
        disabled={!value}
        error={invalid ? 'Enter a time from 00:00 to 23:59.' : undefined}
        onChange={(event) => {
          const next = event.currentTarget.value;
          setTime(next);
          const date = value ? withEtaTime(value, next) : null;
          onValidityChange(date !== null);
          if (date) onChange(date);
        }}
      />
    </Group>
  );
}
