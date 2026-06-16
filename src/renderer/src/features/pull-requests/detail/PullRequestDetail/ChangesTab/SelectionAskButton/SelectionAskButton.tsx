import { useEffect, useRef, useState } from 'react';
import styles from './SelectionAskButton.module.css';

interface SelectionAskButtonProps {
  /** Ref to the container inside which text selection is tracked. */
  containerRef: React.RefObject<HTMLElement | null>;
  onAsk: (selectedText: string) => void;
}

interface ButtonPosition {
  x: number;
  y: number;
}

/**
 * Floating "Ask me" button that appears when the user selects text
 * inside the given container. Positioned at the end of the selection.
 */
export default function SelectionAskButton({ containerRef, onAsk }: SelectionAskButtonProps) {
  const [position, setPosition] = useState<ButtonPosition | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      // Ignore if the click is on the button itself
      if (btnRef.current?.contains(e.target as Node)) return;

      requestAnimationFrame(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim() ?? '';
        const container = containerRef.current;
        if (!text || !container || !selection?.rangeCount) {
          setPosition(null);
          return;
        }
        const range = selection.getRangeAt(0);
        if (!container.contains(range.commonAncestorContainer)) {
          setPosition(null);
          return;
        }
        const selRect = range.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        setSelectedText(text);
        setPosition({
          x: selRect.left - containerRect.left + container.scrollLeft + selRect.width / 2,
          y: selRect.bottom - containerRect.top + container.scrollTop + 4
        });
      });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node)) {
        setPosition(null);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [containerRef]);

  if (!position) return null;

  return (
    <button
      ref={btnRef}
      className={styles.btn}
      style={{ left: position.x, top: position.y }}
      onClick={() => {
        onAsk(selectedText);
        setPosition(null);
        window.getSelection()?.removeAllRanges();
      }}
      title="Ask Copilot about selected code"
      aria-label="Ask Copilot about selected code"
    >
      <i className="fa-solid fa-comment-dots" aria-hidden="true" />
      Ask me
    </button>
  );
}
