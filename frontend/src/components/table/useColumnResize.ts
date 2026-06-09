import { useCallback, useRef, useState } from 'react';

const MIN_WIDTH = 40;

/**
 * Platform-wide column resize hook. Works for both fixed-key and dynamic-index tables.
 *
 * For fixed columns: pass `{ colA: 120, colB: 80, ... }` as initialWidths.
 * For dynamic columns: use string indices `{ "0": 120, "1": 80 }` and call
 * `setColWidths` when columns are added or removed.
 */
export function useColumnResize<K extends string>(initialWidths: Record<K, number>) {
  const [colWidths, setColWidths] = useState<Record<K, number>>(initialWidths);
  const widthsRef = useRef(colWidths);
  widthsRef.current = colWidths;

  const startResize = useCallback((col: K, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = widthsRef.current[col] ?? MIN_WIDTH;

    function onMove(ev: MouseEvent) {
      const next = Math.max(MIN_WIDTH, startWidth + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [col]: next }) as Record<K, number>);
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  return { colWidths, setColWidths, startResize };
}
