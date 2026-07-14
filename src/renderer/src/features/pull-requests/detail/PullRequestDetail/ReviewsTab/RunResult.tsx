import { CopilotReviewComment, CopilotReviewResult, ReviewAttemptUsageSummary, ReviewJob } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import { getElapsedSeconds, getDisplayProgress, getProgressLabel } from '@renderer/utils/progress';
import ReviewSkillMarkersPanel from '@renderer/features/shared/ReviewSkillMarkersPanel/ReviewSkillMarkersPanel';
import CopyButton from '@renderer/features/shared/CopyButton/CopyButton';
import { buildAdoCommentDraft, buildCommentReadKey } from '../PullRequestDetail.helpers';
import { getUsedSkillNames, hasReviewSkillPanelData } from './ReviewsTab.skillUsage';
import { LABELS } from './ReviewsTab.messages';
import styles from './ReviewsTab.module.css';

interface RunResultProps {
  run: { id: string; job: ReviewJob };
  result: CopilotReviewResult | null;
  storedSkillNamesByMarker?: ReadonlyMap<string, string>;
  comments: CopilotReviewComment[];
  selectedSeverityFilter: string | null;
  onSeverityFilterChange: (severity: string | null) => void;
  onNavigateToLine: (file: string, line?: number) => void;
  isCommentRead: (commentKey: string) => boolean;
  onToggleCommentRead: (commentKey: string) => void;
  runNumber: number;
}

const formatUsageSummary = (summary: ReviewAttemptUsageSummary): string => {
  const parts = [
    `tokens ${summary.totalTokens.toLocaleString()}`,
    `in ${summary.inputTokens.toLocaleString()}`,
    `out ${summary.outputTokens.toLocaleString()}`,
    `model ${summary.modelUsed}`
  ];
  if (summary.cacheReadTokens > 0) {
    parts.push(`cache-read ${summary.cacheReadTokens.toLocaleString()}`);
  }
  if (summary.cacheWriteTokens > 0) {
    parts.push(`cache-write ${summary.cacheWriteTokens.toLocaleString()}`);
  }
  if (summary.durationMs != null) {
    parts.push(`duration ${summary.durationMs.toLocaleString()}ms`);
  }
  if (summary.requestCount != null) {
    parts.push(`requests ${summary.requestCount.toLocaleString()}`);
  }
  if (summary.estimatedCost != null) {
    parts.push(`cost ${summary.estimatedCost}`);
  }
  return parts.join(' · ');
};

export default function RunResult({
  run,
  result,
  storedSkillNamesByMarker,
  comments,
  selectedSeverityFilter,
  onSeverityFilterChange,
  onNavigateToLine,
  isCommentRead,
  onToggleCommentRead,
  runNumber
}: RunResultProps) {
  const progress = getDisplayProgress(run.job);
  const progressLabel = getProgressLabel(run.job, progress);
  const usedSkillNames = getUsedSkillNames(run.job, result, storedSkillNamesByMarker);
  const hasSkillPanelData = hasReviewSkillPanelData(run.job);
  const requestedBranchAware = run.job.reviewSessionOptions?.requestedContextMode === 'branch-aware';
  const reviewWorkingDirectory = run.job.reviewSessionOptions?.workingDirectory?.trim() || null;
  const effectiveContextMode = run.job.effectiveContextMode
    ?? (reviewWorkingDirectory ? 'branch-aware' : null);
  const fellBackToDiffOnly = requestedBranchAware && effectiveContextMode === 'diff-only';

  if (run.job.status === 'Queued' || run.job.status === 'Running') {
    return (
      <div className={styles.runProgressStack}>
        <div className={styles.runProgressCard}>
          <div className={styles.runProgressHeader}>
            <span>{progressLabel}</span>
            <span>{run.job.status === 'Running' ? `${getElapsedSeconds(run.job)}s` : ''}</span>
          </div>
          <div className={styles.runProgressTrack}>
            <div
              className={`${styles.runProgressBar} ${run.job.status === 'Running' ? styles.runProgressRunning : ''}`}
              style={{ width: `${run.job.status === 'Queued' ? 0 : progress}%` }}
            />
          </div>
        </div>
        {hasSkillPanelData && (
          <ReviewSkillMarkersPanel job={run.job} className={styles.reviewSkillMarkers} />
        )}
      </div>
    );
  }

  return (
    <>
      <div className="run-body">
        <div><strong>{LABELS.summaryLabel}</strong> {result?.overallSummary ?? run.job.errorMessage ?? ''}</div>
        {result?.titleReview && (
          <div className={styles.titleReviewSection}>
            <strong>{LABELS.titleReviewLabel}</strong>
            {result.titleReview.currentTitle && (
              <div className={styles.titleReviewRow}>
                <span className={styles.titleReviewKey}>{LABELS.currentTitleLabel}</span>
                <span>{result.titleReview.currentTitle}</span>
              </div>
            )}
            {(result.titleReview.suggestedTitle ?? result.titleReview.suggestedEnglishTitle) && (
              <div className={styles.titleReviewRow}>
                <span className={styles.titleReviewKey}>{LABELS.suggestedTitleLabel}</span>
                <span>{result.titleReview.suggestedTitle ?? result.titleReview.suggestedEnglishTitle}</span>
              </div>
            )}
            {result.titleReview.notes && (
              <div className={styles.titleReviewRow}>
                <span className={styles.titleReviewKey}>{LABELS.titleNotesLabel}</span>
                <span>{result.titleReview.notes}</span>
              </div>
            )}
          </div>
        )}
        {result?.reviewMetadata && (
          <div className={styles.reviewMetadata}>
            <i className="fa-solid fa-circle-check" aria-hidden="true" style={{ color: '#4fc3f7', marginRight: 4 }} />
            <strong>{LABELS.contextProofLabel}</strong>{' '}
            {LABELS.attemptPrefix}{result.reviewMetadata.attemptNumber ?? '?'} ·{' '}
            {LABELS.sessionReusedLabel} {result.reviewMetadata.sessionReused ? LABELS.yes : LABELS.no}{' '}
            {result.reviewMetadata.priorFindingsAcknowledged && (
              <> · {LABELS.priorLabel} {result.reviewMetadata.priorFindingsAcknowledged}</>
            )}
          </div>
        )}
        {run.job.attemptUsageSummary && (
          <div className={styles.reviewMetadata}>
            <i className="fa-solid fa-microchip" aria-hidden="true" style={{ color: '#4fc3f7', marginRight: 4 }} />
            <strong>{LABELS.reviewUsageDiagnosticsLabel}</strong>{' '}
            {formatUsageSummary(run.job.attemptUsageSummary)}
          </div>
        )}
        {run.job.isReReview && !result?.reviewMetadata && (
          <div className={styles.reviewMetadata}>
            <i className="fa-solid fa-link" aria-hidden="true" style={{ color: '#4fc3f7', marginRight: 4 }} />
            <strong>{LABELS.serverSideLabel}</strong> {LABELS.reReviewOnSession}
            {run.job.sessionKey && <> · {LABELS.sessionLabel} <code>{run.job.sessionKey}</code></>}
          </div>
        )}
        {(effectiveContextMode || requestedBranchAware) && (
          <div className={styles.reviewMetadata}>
            <i className="fa-solid fa-code-branch" aria-hidden="true" style={{ color: '#4fc3f7', marginRight: 4 }} />
            <strong>{LABELS.reviewContextLabel}</strong>{' '}
            {effectiveContextMode === 'branch-aware' ? LABELS.reviewContextBranchAware : LABELS.reviewContextDiffOnly}
            {requestedBranchAware && effectiveContextMode !== 'branch-aware' && (
              <> · {LABELS.reviewContextRequestedBranchAware}</>
            )}
            {run.job.fallbackReason && (
              <> · {LABELS.reviewContextFallbackLabel} {run.job.fallbackReason}</>
            )}
            {effectiveContextMode === 'branch-aware' && reviewWorkingDirectory && (
              <> · {LABELS.branchContextWorktreePath} <code>{reviewWorkingDirectory}</code></>
            )}
          </div>
        )}
        {fellBackToDiffOnly && run.job.fallbackReason && (
          <div className={styles.reviewFallbackWarning}>
            <div className={styles.reviewFallbackTitle}>
              <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
              <strong>{LABELS.reviewContextFallbackBadge}</strong>
            </div>
            <div>{run.job.fallbackReason}</div>
            <div>{LABELS.reviewContextRetryHint}</div>
          </div>
        )}
        {hasSkillPanelData && (
          <ReviewSkillMarkersPanel job={run.job} className={styles.reviewSkillMarkers} />
        )}
        {!hasSkillPanelData && usedSkillNames.length > 0 && (
          <div className={styles.usedSkillsFallback}>
            <strong>{LABELS.usedSkillsFallbackLabel}</strong>
            <div className={styles.usedSkillsFallbackList}>
              {usedSkillNames.map((skillName) => (
                <span key={`${run.id}-${skillName}`} className={`badge tag ${styles.reviewRunSkillBadge}`}>
                  {skillName}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      {comments.length === 0 ? (
        <div className="empty">{LABELS.noCommentsYet}</div>
      ) : (
        <div className="comments">
          {comments.map((comment, index) => {
            const commentKey = buildCommentReadKey(run.id, comment, index);
            const read = isCommentRead(commentKey);
            return (
              <details key={`${run.id}-${index}`} className={`comment-card ${read ? 'read' : ''}`} open={!read}>
                <summary className="comment-header comment-header-actions-left">
                  <div className="comment-header-actions">
                    <CopyButton
                      text={buildAdoCommentDraft(comment, runNumber)}
                      title={LABELS.copyCommentMarkdown}
                      className="comment-read-btn"
                      feedback
                    />
                    <button
                      type="button"
                      className="comment-read-btn"
                      onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleCommentRead(commentKey); }}
                      title={read ? LABELS.markAsUnread : LABELS.markAsRead}
                    >
                      <i className={`fa-solid ${read ? 'fa-envelope-open' : 'fa-envelope'}`} aria-hidden="true" />
                    </button>
                    <i className="fa-solid fa-chevron-down comment-expander-icon" aria-hidden="true" />
                  </div>
                  <div className="comment-header-main">
                    <div className="comment-badges">
                      {read && <span className="badge tag comment-read-badge">{LABELS.readBadge}</span>}
                      {comment.reviewArea && <span className="badge tag comment-area-badge">{comment.reviewArea}</span>}
                      {comment.category && <span className="badge tag">{comment.category}</span>}
                      {comment.severity && (
                        <button
                          type="button"
                          className={`badge severity severity-filter-btn ${getSeverityClass(comment.severity!)} ${selectedSeverityFilter === getSeverityClass(comment.severity!) ? 'active' : ''}`}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSeverityFilterChange(
                              selectedSeverityFilter === getSeverityClass(comment.severity!)
                                ? null
                                : getSeverityClass(comment.severity!)
                            );
                          }}
                          title={LABELS.filterBySeverity}
                        >
                          {comment.severity}
                        </button>
                      )}
                    </div>
                    <div className="comment-file-row">
                      {comment.file ? (
                        <button
                          type="button"
                          className="comment-file-link"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onNavigateToLine(comment.file!, comment.lineNew);
                          }}
                          title={LABELS.goToFileInChanges}
                        >
                          <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" style={{ fontSize: 10, marginRight: 4 }} />
                          {comment.file}{comment.lineNew ? `:${comment.lineNew}` : ''}
                        </button>
                      ) : (
                        <span className="comment-file-value">{LABELS.dash}</span>
                      )}
                    </div>
                  </div>
                </summary>
                <div className="comment-body">
                  <div className="comment-field">
                    <strong className="comment-field-label">{LABELS.messageLabel}</strong>
                    <div className="comment-field-value">{comment.message || LABELS.dash}</div>
                    <CopyButton text={comment.message ?? ''} title={LABELS.copyMessage} className="comment-copy-btn" feedback />
                  </div>
                  <div className="comment-field">
                    <strong className="comment-field-label">{LABELS.solutionLabel}</strong>
                    <div className="comment-field-value">{comment.solution || LABELS.dash}</div>
                    <CopyButton text={comment.solution ?? ''} title={LABELS.copySolution} className="comment-copy-btn" feedback />
                  </div>
                  <div className="comment-field">
                    <strong className="comment-field-label">{LABELS.suggestionLabel}</strong>
                    <div className="comment-field-value">{comment.suggestion || LABELS.dash}</div>
                    <CopyButton text={comment.suggestion ?? ''} title={LABELS.copySuggestion} className="comment-copy-btn" feedback />
                  </div>
                  <div className="comment-field">
                    <strong className="comment-field-label">{LABELS.evidenceLabel}</strong>
                    <div className="comment-field-value">{comment.evidence || LABELS.dash}</div>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}
