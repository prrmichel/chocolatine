import { getSeverityClass } from '@renderer/utils/severity';
import CommentMarkdown from '@renderer/features/shared/CommentMarkdown/CommentMarkdown';
import { formatSentTimestamp } from '../../PullRequestDetail.helpers';
import { LABELS, copilotRunLabel, lineLabel } from '../ChangesTab.messages';
import type { ReviewCommentEntry } from '../ChangesTab.types';
import styles from '../ChangesTab.module.css';

interface FileLevelCommentsProps {
  entries: ReviewCommentEntry[];
  isCommentRead: (commentKey: string) => boolean;
  onToggleCommentRead: (commentKey: string) => void;
  onAskComment?: (text: string) => void;
  onSendToAdo?: (entry: ReviewCommentEntry) => void;
  getCommentSentAt?: (commentKey: string) => string | null;
}

export default function FileLevelComments({
  entries,
  isCommentRead,
  onToggleCommentRead,
  onAskComment,
  onSendToAdo,
  getCommentSentAt
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
        const sentAt = getCommentSentAt?.(entry.commentKey) ?? null;
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
              {onSendToAdo && (
                <button
                  type="button"
                  className={`diff-inline-comment-send-btn ${sentAt ? 'active' : ''}`}
                  onClick={() => onSendToAdo(entry)}
                  title={sentAt ? LABELS.sentToAdoAt(formatSentTimestamp(sentAt)) : LABELS.sendToAdoTitle}
                  aria-label={sentAt ? LABELS.sentToAdoAt(formatSentTimestamp(sentAt)) : LABELS.sendToAdoTitle}
                >
                  <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                </button>
              )}
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
                <CommentMarkdown content={entry.comment.message ?? ''} className="diff-inline-comment-msg" />
              </div>
              {entry.comment.suggestion && (
                <div className="diff-inline-comment-suggestion">
                  <div className="diff-inline-comment-suggestion-header"><strong>{LABELS.suggestionLabel}</strong></div>
                  <CommentMarkdown content={entry.comment.suggestion} />
                </div>
              )}
              {entry.comment.solution && (
                <div className="diff-inline-comment-solution">
                  <div className="diff-inline-comment-suggestion-header"><strong>Solution:</strong></div>
                  <CommentMarkdown content={entry.comment.solution} />
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
