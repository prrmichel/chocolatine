import { useMemo } from 'react';
import { PrSource, PullRequestStatus, PullRequestSummary, ReviewJob } from '@shared/types/models';
import { LABELS, prCountLabel, runReviewTitle, showPRsAssignedTo } from './PullRequestList.messages';
import styles from './PullRequestList.module.css';

interface PullRequestListProps {
  status: PullRequestStatus;
  requests: PullRequestSummary[];
  reviewJobs: ReviewJob[];
  selectedId?: number | null;
  onSelect: (id: number) => void;
  onQuickReview: (summary: PullRequestSummary) => void;
  canQuickReview?: boolean;
  quickReviewBlockedTitle?: string;
  onStatusChange: (status: PullRequestStatus) => void;
  onRefresh: () => void;
  filterText: string;
  onFilterTextChange: (value: string) => void;
  authorFilterText: string;
  onAuthorFilterTextChange: (value: string) => void;
  authorOptions: string[];
  filterAssignedToMe: boolean;
  onFilterAssignedToMeChange: (value: boolean) => void;
  myDisplayName?: string | null;
  onToggleCollapse: () => void;
  isCollapsed?: boolean;
  prSources: PrSource[];
  activePrSourceId: string | null;
  onPrSourceChange: (id: string) => void;
}

const statusOptions: { value: PullRequestStatus; label: string }[] = [
  { value: 'active', label: LABELS.statusActive },
  { value: 'completed', label: LABELS.statusCompleted },
  { value: 'abandoned', label: LABELS.statusAbandoned },
  { value: 'all', label: LABELS.statusAll }
];

type ReviewerAudienceState = 'accepted' | 'rejected' | 'waiting-for-author' | 'no-vote';

const getReviewerAudienceState = (vote?: number | null): ReviewerAudienceState => {
  const parsedVote = Number(vote ?? 0);
  if (parsedVote >= 5) {
    return 'accepted';
  }
  if (parsedVote <= -10) {
    return 'rejected';
  }
  if (parsedVote === -5) {
    return 'waiting-for-author';
  }
  return 'no-vote';
};

const getReviewerAudienceStatusClass = (state: ReviewerAudienceState): string => (
  state === 'accepted'
    ? 'status-approved'
    : state === 'rejected'
      ? 'status-rejected'
      : state === 'waiting-for-author'
        ? 'status-waiting'
        : ''
);

const getReviewerAudienceTitle = (group: string, state: ReviewerAudienceState): string => (
  state === 'accepted'
    ? `${group}: accepted`
    : state === 'rejected'
      ? `${group}: rejected`
      : state === 'waiting-for-author'
        ? `${group}: waiting for author`
        : `${group}: no vote`
);

const getReviewerGroupVisual = (group: string): { icon: string; title: string } => {
  const normalized = group.toLowerCase();
  if (normalized.includes('tablet code')) {
    return { icon: 'fa-tablet-screen-button', title: `${group} · Tablet code review` };
  }
  if (normalized.includes('code reviewer')) {
    return { icon: 'fa-code', title: `${group} · Code review` };
  }
  if (normalized.includes('sql')) {
    return { icon: 'fa-database', title: `${group} · SQL review` };
  }
  if (normalized.includes('functional')) {
    return { icon: 'fa-clipboard-check', title: `${group} · Functional review` };
  }
  if (normalized.includes('ui reviewer')) {
    return { icon: 'fa-palette', title: `${group} · UI review` };
  }
  if (normalized.includes('devops reviewer')) {
    return { icon: 'fa-gears', title: `${group} · DevOps review` };
  }
  return { icon: 'fa-user-group', title: group };
};

export default function PullRequestList({
  status,
  requests,
  reviewJobs,
  selectedId,
  onSelect,
  onQuickReview,
  canQuickReview = true,
  quickReviewBlockedTitle,
  onStatusChange,
  onRefresh,
  filterText,
  onFilterTextChange,
  authorFilterText,
  onAuthorFilterTextChange,
  authorOptions,
  filterAssignedToMe,
  onFilterAssignedToMeChange,
  myDisplayName,
  onToggleCollapse,
  isCollapsed = false,
  prSources,
  activePrSourceId,
  onPrSourceChange
}: PullRequestListProps) {
  const reviewStatsByPrId = useMemo(() => {
    const stats = new Map<number, { count: number; hasActive: boolean }>();

    for (const job of reviewJobs) {
      if (job.taskType === 'Changes summary') {
        continue;
      }

      const pullRequestId = job.pullRequest?.id;
      if (!pullRequestId) {
        continue;
      }

      const current = stats.get(pullRequestId) ?? { count: 0, hasActive: false };
      current.count += 1;

      if (job.status === 'Running') {
        current.hasActive = true;
      } else if (job.status === 'Queued') {
        current.hasActive = true;
      }

      stats.set(pullRequestId, current);
    }

    return stats;
  }, [reviewJobs]);

  return (
    <section className={`panel list ${styles.prList}`}>
      <div className={styles.prListDocked}>
        {prSources.length > 1 && (
          <div className={styles.prSourceSelector}>
            <select
              value={activePrSourceId ?? ''}
              onChange={(e) => onPrSourceChange(e.target.value)}
              title={LABELS.switchPrSource}
            >
              {prSources.map((src) => (
                <option key={src.id} value={src.id}>{src.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className="panel-header row between">
          <span className={styles.prCount}>
            {prCountLabel(requests.length)}
          </span>
          <div className="row">
            <select value={status} onChange={(event) => onStatusChange(event.target.value as PullRequestStatus)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              className={`btn ${styles.prListIconBtn}`}
              onClick={onRefresh}
              title={LABELS.refreshPRs}
              aria-label={LABELS.refreshPRs}
            >
              <i className="fa-solid fa-rotate-right" aria-hidden="true" />
            </button>
            <button
              className="btn"
              onClick={onToggleCollapse}
              title={isCollapsed ? LABELS.pinList : LABELS.unpinList}
              aria-label={isCollapsed ? LABELS.pinList : LABELS.unpinList}
            >
              <i className={`fa-solid ${isCollapsed ? 'fa-thumbtack-slash' : 'fa-thumbtack'}`} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className={`list-filter ${styles.prListFilters}`}>
          <div className={styles.filterRow}>
            <input
              type="text"
              placeholder={LABELS.filterPlaceholder}
              value={filterText}
              onChange={(event) => onFilterTextChange(event.target.value)}
            />
            <button
              className={`btn ${filterAssignedToMe ? 'accent' : ''}`}
              title={
                filterAssignedToMe && !myDisplayName?.trim()
                  ? LABELS.setDisplayNameHint
                  : myDisplayName?.trim()
                    ? showPRsAssignedTo(myDisplayName.trim())
                    : LABELS.filterAssignedNoName
              }
              aria-label={LABELS.filterAssigned}
              aria-pressed={filterAssignedToMe}
              onClick={() => onFilterAssignedToMeChange(!filterAssignedToMe)}
            >
              <i className="fa-solid fa-user-check" aria-hidden="true" />
            </button>
          </div>
          <div className={styles.filterRow}>
            <select
              className={styles.authorSelect}
              value={authorFilterText}
              onChange={(event) => onAuthorFilterTextChange(event.target.value)}
            >
              <option value="">{LABELS.allAuthors}</option>
              {authorOptions.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="list-items">
        {requests.length === 0 ? (
          <div className="empty">{LABELS.noPRs}</div>
        ) : (
          requests.map((pr) => {
            const reviewStats = reviewStatsByPrId.get(pr.id);
            const reviewCount = reviewStats?.count ?? 0;
            const hasActiveReview = reviewStats?.hasActive ?? false;
            const reviewerAudiences = Array.from(
              new Map((pr.reviewerAudiences ?? []).map((audience) => [audience.name.toLowerCase(), audience])).values()
            );
            return (
            <div
              key={pr.id}
              role="button"
              tabIndex={0}
              className={`list-item ${selectedId === pr.id ? 'selected' : ''}`}
              onClick={() => onSelect(pr.id)}
              onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(pr.id); } }}
            >
              <div className="list-title">
                #{pr.id} · {pr.title}
                {reviewerAudiences.length > 0 && (
                  <span className={styles.reviewerGroupsInline}>
                    {reviewerAudiences.map((audience) => {
                      const visual = getReviewerGroupVisual(audience.name);
                      const reviewerState = getReviewerAudienceState(audience.vote);
                      const reviewerStatusClass = getReviewerAudienceStatusClass(reviewerState);
                      const reviewerTitle = getReviewerAudienceTitle(audience.name, reviewerState);
                      return (
                        <span
                          key={`${pr.id}-${audience.name}`}
                          className={`list-badge ${styles.reviewerGroupBadge} ${styles.reviewersStateBadge} ${reviewerStatusClass}`}
                          title={reviewerTitle}
                          aria-label={reviewerTitle}
                        >
                          <i className={`fa-solid ${visual.icon}`} aria-hidden="true" />
                        </span>
                      );
                    })}
                  </span>
                )}
                {pr.isDraft && <span className="list-badge">{LABELS.draft}</span>}
                {pr.targetRef && pr.targetRef !== 'refs/heads/master' && (
                  <span
                    className="list-badge target-branch"
                    title={pr.targetRef}
                  >
                    {pr.targetRef.split('/').filter(Boolean).pop()}
                  </span>
                )}
              </div>
              <div className="list-meta">{pr.author || LABELS.unknownAuthor}</div>
              <div className={styles.reviewRunRow}>
                <span
                  role="button"
                  tabIndex={0}
                  className={`${styles.reviewRunCount} ${reviewCount >= 1 ? styles.reviewRunCountHasRuns : ''} ${hasActiveReview ? styles.reviewRunCountActive : ''}`}
                  title={canQuickReview ? runReviewTitle(reviewCount) : (quickReviewBlockedTitle ?? LABELS.runReviewUnavailable)}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (!canQuickReview) {
                      return;
                    }
                    onQuickReview(pr);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!canQuickReview) {
                        return;
                      }
                      onQuickReview(pr);
                    }
                  }}
                  aria-label={canQuickReview ? LABELS.runDefaultReview : LABELS.runReviewUnavailable}
                >
                  {hasActiveReview && <span className={styles.reviewRunSpinner} />}
                  <span className={styles.reviewRunCountText}>{reviewCount}</span>
                  <i className={`fa-solid fa-play ${styles.reviewRunPlayIcon}`} aria-hidden="true" />
                </span>
              </div>
            </div>
            );
          })
        )}
      </div>
    </section>
  );
}
