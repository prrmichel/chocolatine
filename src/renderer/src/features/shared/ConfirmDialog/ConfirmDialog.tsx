import { useState } from 'react';
import { LABELS, typeToConfirmLabel } from './ConfirmDialog.messages';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** If provided, the user must type this word before the confirm button is enabled. */
  confirmWord?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = LABELS.confirm,
  cancelLabel = LABELS.cancel,
  confirmWord,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('');

  if (!isOpen) {
    return null;
  }

  const handleCancel = () => {
    setTyped('');
    onCancel();
  };

  const handleConfirm = () => {
    if (confirmWord && typed.trim().toLowerCase() !== confirmWord.toLowerCase()) return;
    setTyped('');
    onConfirm();
  };

  const canConfirm = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  return (
    <div className="modal-backdrop" onClick={handleCancel}>
      <div className={`modal ${styles.confirmDialog}`} onClick={(event) => event.stopPropagation()}>
        <div className={`modal-header ${styles.confirmHeader}`}>
          <h2>{title}</h2>
        </div>
        <div className={`modal-body ${styles.confirmBody}`}>
          <p>{message}</p>
          {confirmWord && (
            <div className={styles.confirmWordRow}>
              <label htmlFor="confirm-word-input" className={styles.confirmWordLabel}>
                {typeToConfirmLabel(confirmWord).replace(confirmWord, '')}<strong>{confirmWord}</strong>:
              </label>
              <input
                id="confirm-word-input"
                className="input"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
                autoFocus
                autoComplete="off"
              />
            </div>
          )}
        </div>
        <div className={`modal-footer ${styles.confirmFooter}`}>
          <button className="btn" onClick={handleCancel}>{cancelLabel}</button>
          <button className="btn btn-danger" onClick={handleConfirm} disabled={!canConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
