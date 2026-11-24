import { Text, UnstyledButton } from '@mantine/core';
import classes from './NominationSectionHeader.module.css';

interface NominationSectionHeaderProps {
  label: string;
  expanded: boolean;
  controls: string;
  onToggle: () => void;
  compact?: boolean;
}

export function NominationSectionHeader({
  label,
  expanded,
  controls,
  onToggle,
  compact = false,
}: NominationSectionHeaderProps) {
  return (
    <UnstyledButton
      type="button"
      className={classes.header}
      data-expanded={expanded || undefined}
      data-compact={compact || undefined}
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onToggle}
    >
      <Text component="span" fw={600} size={compact ? 'sm' : 'md'}>
        {label}
      </Text>
      <span className={classes.indicator} aria-hidden="true">
        {expanded ? '−' : '+'}
      </span>
    </UnstyledButton>
  );
}
