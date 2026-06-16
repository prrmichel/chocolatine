import { copyToClipboard } from '@renderer/utils/clipboard';

interface CopyButtonProps {
  text: string;
  title?: string;
  className?: string;
  disabled?: boolean;
  /** FontAwesome icon class; defaults to "fa-regular fa-copy" */
  icon?: string;
}

export default function CopyButton({
  text,
  title = 'Copy',
  className = 'btn',
  disabled = false,
  icon = 'fa-regular fa-copy'
}: CopyButtonProps) {
  return (
    <button
      className={className}
      onClick={() => { void copyToClipboard(text); }}
      title={title}
      aria-label={title}
      disabled={disabled || !text}
    >
      <i className={icon} aria-hidden="true" />
    </button>
  );
}
