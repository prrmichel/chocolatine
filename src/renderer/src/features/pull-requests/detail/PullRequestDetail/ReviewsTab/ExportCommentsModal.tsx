import { useState, useMemo, useCallback } from 'react';
import { CopilotReviewComment, CopilotReviewResult, ReviewJob } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import CopyButton from '@renderer/features/shared/CopyButton/CopyButton';
import { buildBulkExportMarkdown, formatRunDate } from '../PullRequestDetail.helpers';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { LABELS } from './ReviewsTab.messages';
import styles from './ExportCommentsModal.module.css';

interface ExportCommentsModalProps {
  run: { runNumber: number; job: ReviewJob; result: CopilotReviewResult | null };
  comments: CopilotReviewComment[];
  onClose: () => void;
}

export default function ExportCommentsModal({
  run,
  comments,
  onClose
}: ExportCommentsModalProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(() => new Set(comments.map((_, i) => i)));

  const toggleIndex = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(comments.map((_, i) => i)));
  }, [comments]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const selectBySeverity = useCallback(
    (severity: string) => {
      setSelectedIndices(
        new Set(
          comments.reduce<number[]>((acc, c, i) => {
            if ((c.severity ?? 'Info') === severity) acc.push(i);
            return acc;
          }, [])
        )
      );
    },
    [comments]
  );

  const severityValues = useMemo(() => {
    const unique = new Set(comments.map((c) => c.severity ?? 'Info'));
    return Array.from(unique).sort();
  }, [comments]);

  const selectedComments = useMemo(
    () => comments.filter((_, i) => selectedIndices.has(i)),
    [comments, selectedIndices]
  );

  const summaryText = run.result?.overallSummary ?? run.job.errorMessage ?? '';
  const modelName = getModelDisplayName(run.job.modelName);
  const runDate = formatRunDate(run.job);

  const exportMarkdown = useMemo(
    () => buildBulkExportMarkdown(selectedComments, run.runNumber, modelName, runDate, summaryText || undefined),
    [selectedComments, run.runNumber, modelName, runDate, summaryText]
  );

  if (comments.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className={`modal ${styles.exportModal}`} onClick={(e) => e.stopPropagation()}>
          <div className="modal-header row between">
            <h2>{LABELS.exportCommentsTitle(run.runNumber)}</h2>
          </div>
          <div className={styles.modalBody}>
            <div className={styles.emptyState}>{LABELS.noCommentsToExport}</div>
          </div>
          <div className="modal-footer">
            <button className="btn" type="button" onClick={onClose}>
              {LABELS.closeExportModal}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${styles.exportModal}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header row between">
          <h2>{LABELS.exportCommentsTitle(run.runNumber)}</h2>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarActions}>
              <button className="btn" type="button" onClick={selectAll}>
                <i className="fa-solid fa-check-square" aria-hidden="true" /> {LABELS.selectAll}
              </button>
              <button className="btn" type="button" onClick={deselectAll}>
                <i className="fa-regular fa-square" aria-hidden="true" /> {LABELS.deselectAll}
              </button>
              {severityValues.map((severity) => (
                <button
                  key={severity}
                  className={`badge severity ${getSeverityClass(severity)} ${styles.severityBtn}`}
                  type="button"
                  onClick={() => selectBySeverity(severity)}
                  title={LABELS.selectSeverity(severity)}
                >
                  {severity}
                </button>
              ))}
            </div>
            <span className={styles.selectionCount}>{LABELS.selectedCount(selectedIndices.size)}</span>
          </div>
          {summaryText && (
            <div className={styles.summarySection}>
              <div className={styles.summaryLabel}>{LABELS.summaryLabel}</div>
              <div className={styles.summaryText}>{summaryText}</div>
            </div>
          )}
          <div className={styles.commentList}>
            {comments.map((comment, index) => {
              const isSelected = selectedIndices.has(index);
              return (
                <div
                  key={index}
                  className={`${styles.commentCard} ${isSelected ? styles.commentCardSelected : ''}`}
                  onClick={() => toggleIndex(index)}
                >
                  <div className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleIndex(index)}
                      aria-label={`Select comment ${index + 1}`}
                    />
                  </div>
                  <div className={styles.commentBody}>
                    <div className={styles.commentHeader}>
                      {comment.severity && (
                        <span className={`badge severity ${getSeverityClass(comment.severity)}`}>
                          {comment.severity}
                        </span>
                      )}
                      {comment.category && <span className="badge tag">{comment.category}</span>}
                      {comment.reviewArea && <span className="badge tag comment-area-badge">{comment.reviewArea}</span>}
                      {comment.file && (
                        <span className="badge tag">
                          {comment.file}
                          {comment.lineNew ? `:${comment.lineNew}` : ''}
                        </span>
                      )}
                    </div>
                    {comment.message && (
                      <div className={styles.commentField}>
                        <span className={styles.commentFieldLabel}>{LABELS.messageLabel}</span>
                        <span className={styles.commentFieldValue}>{comment.message}</span>
                      </div>
                    )}
                    {comment.evidence && (
                      <div className={styles.commentField}>
                        <span className={styles.commentFieldLabel}>{LABELS.evidenceLabel}</span>
                        <span className={styles.commentFieldValue}>{comment.evidence}</span>
                      </div>
                    )}
                    {comment.suggestion && (
                      <div className={styles.commentField}>
                        <span className={styles.commentFieldLabel}>{LABELS.suggestionLabel}</span>
                        <span className={styles.commentFieldValue}>{comment.suggestion}</span>
                      </div>
                    )}
                    {comment.solution && (
                      <div className={styles.commentField}>
                        <span className={styles.commentFieldLabel}>{LABELS.solutionLabel}</span>
                        <span className={styles.commentFieldValue}>{comment.solution}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modal-footer">
          {selectedIndices.size > 0 && (
            <CopyButton
              text={exportMarkdown}
              title={LABELS.copySelectedMarkdown}
              className="btn"
              feedback
            />
          )}
          <button className="btn" type="button" onClick={onClose}>
            {LABELS.closeExportModal}
          </button>
        </div>
      </div>
    </div>
  );
}
