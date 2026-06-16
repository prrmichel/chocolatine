import { useCallback } from 'react';

interface UseResizeDragOptions {
  direction: 'horizontal' | 'vertical';
  startSize: number;
  minSize: number;
  maxSize: number;
  onResize: (size: number) => void;
}

/**
 * Returns a mousedown handler that starts a drag‑to‑resize interaction.
 *
 * @param direction  'horizontal' for left/right, 'vertical' for up/down
 * @param startSize  current size in px
 * @param minSize    minimum allowed size
 * @param maxSize    maximum allowed size
 * @param onResize   setter called while dragging
 */
export function useResizeDrag({
  direction,
  startSize,
  minSize,
  maxSize,
  onResize
}: UseResizeDragOptions) {
  return useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      const origin = direction === 'horizontal' ? event.clientX : event.clientY;

      const handleMove = (moveEvent: MouseEvent) => {
        const current = direction === 'horizontal' ? moveEvent.clientX : moveEvent.clientY;
        const delta = direction === 'vertical' ? origin - current : current - origin;
        onResize(Math.max(minSize, Math.min(startSize + delta, maxSize)));
      };

      const handleUp = () => {
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [direction, startSize, minSize, maxSize, onResize]
  );
}
