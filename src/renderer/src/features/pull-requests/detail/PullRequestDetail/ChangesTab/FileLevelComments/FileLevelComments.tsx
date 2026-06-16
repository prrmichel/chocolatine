import { CopilotReviewComment } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import { LABELS, copilotRunLabel, lineLabel } from '../ChangesTab.messages';
import styles from '../ChangesTab.module.css';

interface FileLevelCommentsEntry {
  comment: CopilotReviewComment;
  runNumber: number;
  runId: string;
  commentKey: string;
}

interface FileLevelCommentsProps {
  entries: FileLevelCommentsEntry[];
  isCommentRead: (commentKey: string) => boolean;
  onToggleCommentRead: (commentKey: string) => void;
  onAskComment?: (text: string) => void;
}

export default function FileLevelComments({
  entries,
  isCommentRead,
  onToggleCommentRead,
  onAskComment
}: FileLevelCommentsProps) {
  if (entries.length === 0) return null;

  return (
    <div className={styles.topLevelComments}>
      <h4 className={styles.topLevelCommentsTitle}>
        <i className="fa-solid fa-robot" aria-hidden="true" /> {LABELS.fileLevelCommentsPrefix} ({entries.length})
        <span className={styles.topLevelCommentsHint}>{LABELS.fileLevelCommentsHint}</span>
      </h4>
      {entries.map((entry, ci) => {
        const read = isCommentRead(entry.commentKey);
        return (
          <div key={`top-${ci}`} className={`diff-inline-comment ${read ? 'read' : ''}`}>
            <div className="diff-inline-comment-header" style={{ cursor: 'default' }}>
              <span className="diff-inline-comment-avatar">
                <i className="fa-solid fa-robot" aria-hidden="true" />
              </span>
              <span className="diff-inline-comment-meta">
                <span className="diff-inline-comment-author">{copilotRunLabel(entry.runNumber)}</span>
                {read && <span className="badge tag diff-inline-read-badge">{LABELS.readBadge}</span>}
                <span className={`badge severity ${getSeverityClass(entry.comment.severity ?? '')}`}>
                  {entry.comment.severity ?? 'Info'}
                </span>
                {entry.comment.reviewArea && <span className="badge tag">{entry.comment.reviewArea}</span>}
                {entry.comment.category && <span className="badge tag">{entry.comment.category}</span>}
              </span>
              <button
                type="button"
                className="diff-inline-comment-read-btn"
                onClick={() => onToggleCommentRead(entry.commentKey)}
                title={read ? LABELS.markAsUnread : LABELS.markAsRead}
                aria-label={read ? LABELS.markAsUnread : LABELS.markAsRead}
              >
                <i className={`fa-solid ${read ? 'fa-envelope-open' : 'fa-envelope'}`} aria-hidden="true" />
              </button>
            </div>
            {(entry.comment.lineNew || entry.comment.evidence) && (
              <div className={styles.topLevelCodeContext}>
                <span className={styles.topLevelLineNum}>
                  <i className="fa-solid fa-code" aria-hidden="true" />
                  {' '}{lineLabel(entry.comment.lineNew ?? 0)}
                  <span className={styles.topLevelNotInDiff}>{LABELS.referencedLineNotInDiff}</span>
                </span>
                {entry.comment.evidence && (
                  <pre className={styles.topLevelEvidenceCode}><code>{entry.comment.evidence}</code></pre>
                )}
              </div>
            )}
            <div className="diff-inline-comment-body">
              <div className="diff-inline-comment-msg-row">
                <div className="diff-inline-comment-msg">{entry.comment.message ?? ''}</div>
              </div>
              {entry.comment.suggestion && (
                <div className="diff-inline-comment-suggestion">
                  <div className="diff-inline-comment-suggestion-header"><strong>{LABELS.suggestionLabel}</strong></div>
                  <div>{entry.comment.suggestion}</div>
                </div>
              )}
              {onAskComment && (
                <div className="diff-inline-comment-actions">
                  <button
                    type="button"
                    className="diff-inline-comment-action-btn"
                    onClick={() => {
                      const parts = [entry.comment.message ?? ''];
                      if (entry.comment.suggestion) parts.push(`Suggestion: ${entry.comment.suggestion}`);
                      onAskComment(parts.join('\n'));
                    }}
                    title="Ask Copilot about this comment"
                  >
                    <i className="fa-solid fa-comment-dots" aria-hidden="true" /> Ask me
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
