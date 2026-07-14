import { useState, useEffect, useRef } from 'react';
import { copyToClipboard } from '@renderer/utils/clipboard';

const FEEDBACK_DURATION_MS = 2000;

interface CopyButtonProps {
  text: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  /** FontAwesome icon class; defaults to "fa-regular fa-copy" */
  icon?: string;
  /** When true, briefly shows a checkmark and "Copied!" tooltip after copying. */
  feedback?: boolean;
}

export default function CopyButton({
  text,
  title = 'Copy',
  className = 'btn',
  disabled = false,
  icon = 'fa-regular fa-copy',
  feedback = false
}: CopyButtonProps) {
  const [justCopied, setJustCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    void copyToClipboard(text);
    if (!feedback) return;

    setJustCopied(true);
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setJustCopied(false);
      timerRef.current = null;
    }, FEEDBACK_DURATION_MS);
  };

  const displayTitle = feedback && justCopied ? 'Copied!' : title;
  const displayIcon = feedback && justCopied ? 'fa-solid fa-check' : icon;

  return (
    <button
      className={className}
      onClick={handleClick}
      title={displayTitle}
      aria-label={displayTitle}
      disabled={disabled || !text}
    >
      <i className={displayIcon} aria-hidden="true" />
    </button>
  );
}
