import { useMemo } from 'react';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { CopilotReviewResult, ReviewJob } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import { formatRunDate } from '../PullRequestDetail.helpers';
import { getUsedSkillNames } from './ReviewsTab.skillUsage';
import { LABELS, runHeaderTitle, severityBadgeTitle, usedSkillsTitle } from './ReviewsTab.messages';
import styles from './ReviewsTab.module.css';

interface RunHeaderProps {
  run: { runNumber: number; job: ReviewJob };
  result: CopilotReviewResult | null;
  storedSkillNamesByMarker?: ReadonlyMap<string, string>;
  onOpenFollowUp?: (job: ReviewJob) => void;
  onOpenPrompt?: () => void;
  onMarkRead?: () => void;
  onMarkUnread?: () => void;
  isCollapsible?: boolean;
}

export default function RunHeader({
  run,
  result,
  storedSkillNamesByMarker,
  onOpenFollowUp,
  onOpenPrompt,
  onMarkRead,
  onMarkUnread,
  isCollapsible = false
}: RunHeaderProps) {
  const isEnglish = result?.titleReview?.isEnglish;
  const usedSkillNames = useMemo(
    () => getUsedSkillNames(run.job, result, storedSkillNamesByMarker),
    [run.job, result, storedSkillNamesByMarker]
  );
  const requestedBranchAware = run.job.reviewSessionOptions?.requestedContextMode === 'branch-aware';
  const fellBackToDiffOnly = requestedBranchAware && run.job.effectiveContextMode === 'diff-only';
  const severityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const comment of result?.comments ?? []) {
      const severity = comment.severity ?? 'Info';
      counts.set(severity, (counts.get(severity) ?? 0) + 1);
    }
    const order = ['Error', 'Warning', 'Info'];
    const preferred = order
      .filter((severity) => counts.has(severity))
      .map((severity) => ({ severity, count: counts.get(severity) ?? 0 }));
    const others = Array.from(counts.entries())
      .filter(([severity]) => !order.includes(severity))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([severity, count]) => ({ severity, count }));
    return [...preferred, ...others];
  }, [result]);

  return (
    <div className={styles.reviewRunHeader}>
      <div className={styles.reviewRunTitle}>{runHeaderTitle(run.runNumber, getModelDisplayName(run.job.modelName), formatRunDate(run.job))}{run.job.batchLabel ? ` · ${run.job.batchLabel}` : ''}</div>
      {severityCounts.length > 0 && (
        <div className={styles.reviewRunSeverityCounts}>
          {severityCounts.map((entry) => (
            <span
              key={`${run.runNumber}-${entry.severity}`}
              className={`badge severity ${getSeverityClass(entry.severity)} ${styles.reviewRunSeverityBadge}`}
              title={severityBadgeTitle(entry.count, entry.severity)}
            >
              {entry.severity}: {entry.count}
            </span>
          ))}
        </div>
      )}
      {fellBackToDiffOnly && <span className="badge status-rejected">{LABELS.reviewContextFallbackBadge}</span>}
      {isEnglish === true && <span className="badge status-approved">{LABELS.titleInEnglish}</span>}
      {isEnglish === false && <span className="badge status-rejected">{LABELS.titleNotInEnglish}</span>}
      {usedSkillNames.length > 0 && (
        <div className={styles.reviewRunSkillList} title={usedSkillsTitle(usedSkillNames)} aria-label={usedSkillsTitle(usedSkillNames)}>
          <span className={styles.reviewRunSkillLabel}>{LABELS.usedSkillsLabel}</span>
          {usedSkillNames.map((skillName) => (
            <span key={`${run.runNumber}-${skillName}`} className={`badge tag ${styles.reviewRunSkillBadge}`}>
              {skillName}
            </span>
          ))}
        </div>
      )}
      <div className={styles.reviewRunHeaderActions}>
        {onMarkRead && (
          <button
            className="btn"
            onClick={(event) => {
              if (isCollapsible) { event.preventDefault(); event.stopPropagation(); }
              onMarkRead();
            }}
            title={LABELS.markAllReadTitleSingle}
            aria-label={LABELS.markAllReadTitleSingle}
          >
            <i className="fa-solid fa-envelope-open" aria-hidden="true" />
          </button>
        )}
        {onMarkUnread && (
          <button
            className="btn"
            onClick={(event) => {
              if (isCollapsible) { event.preventDefault(); event.stopPropagation(); }
              onMarkUnread();
            }}
            title={LABELS.markAllUnreadTitleSingle}
            aria-label={LABELS.markAllUnreadTitleSingle}
          >
            <i className="fa-solid fa-envelope" aria-hidden="true" />
          </button>
        )}
        {run.job.status === 'Completed' && run.job.reviewResponse && onOpenFollowUp && (
          <button
            className="btn"
            onClick={(event) => {
              if (isCollapsible) {
                event.preventDefault();
                event.stopPropagation();
              }
              onOpenFollowUp(run.job);
            }}
            title={LABELS.chatAboutRun}
            aria-label={LABELS.chatAboutRun}
          >
            <i className="fa-solid fa-comments" aria-hidden="true" />
          </button>
        )}
        {onOpenPrompt && (
          <button
            className="btn"
            onClick={(event) => {
              if (isCollapsible) {
                event.preventDefault();
                event.stopPropagation();
              }
              onOpenPrompt();
            }}
            title={LABELS.viewExecutedPrompt}
            aria-label={LABELS.viewExecutedPrompt}
          >
            <i className="fa-solid fa-circle-info" aria-hidden="true" />
          </button>
        )}
        {isCollapsible && <i className={`fa-solid fa-chevron-down ${styles.reviewRunChevron}`} aria-hidden="true" />}
      </div>
    </div>
  );
}
