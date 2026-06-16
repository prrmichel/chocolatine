import { LABELS } from '../ChangesTab.messages';
import styles from '../ChangesTab.module.css';

interface RunFilterOption {
  id: string;
  label: string;
  commentCount?: number;
}

interface FilterToolbarProps {
  runFilterOptions: RunFilterOption[];
  allRunsSelected: boolean;
  selectedRunIdSet: Set<string>;
  hideAllRuns: boolean;
  showUserComments: boolean;
  showReadComments: boolean;
  showUnreadComments: boolean;
  visibleCommentKeyCount: number;
  onSelectAllRuns: () => void;
  onToggleRunSelection: (runId: string) => void;
  onHideAllRuns: () => void;
  onToggleUserComments: () => void;
  onToggleReadComments: () => void;
  onToggleUnreadComments: () => void;
  onMarkCommentsRead: () => void;
  onMarkCommentsUnread: () => void;
}

export default function FilterToolbar({
  runFilterOptions,
  allRunsSelected,
  selectedRunIdSet,
  hideAllRuns,
  showUserComments,
  showReadComments,
  showUnreadComments,
  visibleCommentKeyCount,
  onSelectAllRuns,
  onToggleRunSelection,
  onHideAllRuns,
  onToggleUserComments,
  onToggleReadComments,
  onToggleUnreadComments,
  onMarkCommentsRead,
  onMarkCommentsUnread
}: FilterToolbarProps) {
  return (
    <div className={styles.changesFilter}>
      <div className={styles.changesFilterControls}>
        <div className={styles.badgeFilterGroup}>
          <span className={styles.badgeFilterLabel}>{LABELS.runsGroup}</span>
          <button
            type="button"
            className={`${styles.badgeFilter} ${allRunsSelected ? styles.badgeFilterActive : ''}`}
            onClick={onSelectAllRuns}
          >
            {LABELS.allRuns}
          </button>
          {runFilterOptions.map((run) => (
            <button
              key={run.id}
              type="button"
              className={`${styles.badgeFilter} ${!hideAllRuns && selectedRunIdSet.has(run.id) ? styles.badgeFilterActive : ''}`}
              onClick={() => onToggleRunSelection(run.id)}
            >
              {run.label}
              {run.commentCount != null && (
                <span className={styles.badgeFilterCount}>{run.commentCount}</span>
              )}
            </button>
          ))}
          <button
            type="button"
            className={`${styles.badgeFilter} ${hideAllRuns ? styles.badgeFilterActive : ''}`}
            onClick={onHideAllRuns}
            title={LABELS.hideAllGeneratedComments}
          >
            {LABELS.none}
          </button>
        </div>
        <div className={styles.badgeFilterGroup}>
          <span className={styles.badgeFilterLabel}>{LABELS.userComments}</span>
          <button
            type="button"
            className={`${styles.badgeFilter} ${showUserComments ? styles.badgeFilterActive : ''}`}
            onClick={onToggleUserComments}
          >
            {showUserComments ? LABELS.shown : LABELS.hidden}
          </button>
        </div>
        <div className={styles.badgeFilterGroup}>
          <span className={styles.badgeFilterLabel}>{LABELS.readComments}</span>
          <button
            type="button"
            className={`${styles.badgeFilter} ${showReadComments ? styles.badgeFilterActive : ''}`}
            onClick={onToggleReadComments}
          >
            {showReadComments ? LABELS.shown : LABELS.hidden}
          </button>
        </div>
        <div className={styles.badgeFilterGroup}>
          <span className={styles.badgeFilterLabel}>{LABELS.unreadComments}</span>
          <button
            type="button"
            className={`${styles.badgeFilter} ${showUnreadComments ? styles.badgeFilterActive : ''}`}
            onClick={onToggleUnreadComments}
          >
            {showUnreadComments ? LABELS.shown : LABELS.hidden}
          </button>
        </div>
        <div className={styles.markReadActions}>
          <button
            type="button"
            className={styles.markReadBtn}
            onClick={onMarkCommentsRead}
            disabled={visibleCommentKeyCount === 0}
            title={allRunsSelected ? LABELS.markAllReadTitleAll : LABELS.markAllReadTitleSelected}
            aria-label={allRunsSelected ? LABELS.markAllReadTitleAll : LABELS.markAllReadTitleSelected}
          >
            <i className="fa-solid fa-envelope-open" aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.markReadBtn}
            onClick={onMarkCommentsUnread}
            disabled={visibleCommentKeyCount === 0}
            title={allRunsSelected ? LABELS.markAllUnreadTitleAll : LABELS.markAllUnreadTitleSelected}
            aria-label={allRunsSelected ? LABELS.markAllUnreadTitleAll : LABELS.markAllUnreadTitleSelected}
          >
            <i className="fa-solid fa-envelope" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
