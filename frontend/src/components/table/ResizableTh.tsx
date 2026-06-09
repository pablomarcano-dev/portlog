import { Table } from '@mantine/core';
import type { CSSProperties, ReactNode } from 'react';

interface ResizableThProps {
  width: number;
  onResize: (e: React.MouseEvent) => void;
  children?: ReactNode;
  style?: CSSProperties;
}

/**
 * Drop-in replacement for Table.Th that adds a drag handle on the right edge.
 * Pair with useColumnResize to manage widths.
 */
export function ResizableTh({ width, onResize, children, style }: ResizableThProps) {
  return (
    <Table.Th
      style={{
        width,
        minWidth: width,
        position: 'relative',
        userSelect: 'none',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
      <div
        onMouseDown={onResize}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 5,
          cursor: 'col-resize',
          zIndex: 1,
        }}
      />
    </Table.Th>
  );
}
