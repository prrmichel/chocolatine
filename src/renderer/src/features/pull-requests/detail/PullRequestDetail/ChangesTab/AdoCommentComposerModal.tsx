import type { ReviewCommentEntry } from './ChangesTab.types';
import { LABELS, runLabel } from './ChangesTab.messages';
import styles from './AdoCommentComposerModal.module.css';

interface AdoCommentComposerModalProps {
  entry: ReviewCommentEntry | null;
  draft: string;
  sending: boolean;
  error: string | null;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSend: () => void;
}

export default function AdoCommentComposerModal({
  entry,
  draft,
  sending,
  error,
  onDraftChange,
  onCancel,
  onSend
}: AdoCommentComposerModalProps) {
  if (!entry) {
    return null;
  }

  const filePath = entry.comment.file?.trim() || '';
  const line = entry.comment.lineNew && entry.comment.lineNew > 0 ? entry.comment.lineNew : null;

  return (
    <div className="modal-backdrop" onClick={sending ? undefined : onCancel}>
      <div className={`modal ${styles.adoComposerModal}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{LABELS.sendToAdoModalTitle}</h2>
        </div>
        <div className="modal-body">
          <div className={styles.adoComposerContext}>
            <div className={styles.adoComposerMeta}>
              <span className="badge tag">{runLabel(entry.runNumber)}</span>
              {entry.comment.severity && <span className="badge tag">{entry.comment.severity}</span>}
              {entry.comment.category && <span className="badge tag">{entry.comment.category}</span>}
              {filePath && <span className="badge tag">{filePath}{line ? `:${line}` : ''}</span>}
            </div>
          </div>
          <label className="form-label" htmlFor="ado-comment-draft">
            <span>{LABELS.sendToAdoTextareaLabel}</span>
            <textarea
              id="ado-comment-draft"
              className={`textarea ${styles.adoComposerTextarea}`}
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              rows={14}
              autoFocus
              disabled={sending}
            />
          </label>
          {error && (
            <div className={styles.adoComposerError} role="alert">
              <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" type="button" onClick={onCancel} disabled={sending}>
            {LABELS.cancelSendToAdo}
          </button>
          <button className="btn" type="button" onClick={onSend} disabled={sending || draft.trim().length === 0}>
            {sending ? LABELS.sendingToAdo : LABELS.confirmSendToAdo}
          </button>
        </div>
      </div>
    </div>
  );
}
