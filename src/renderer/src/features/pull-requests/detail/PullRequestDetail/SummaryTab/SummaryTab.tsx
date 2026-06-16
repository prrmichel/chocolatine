import { getModelDisplayName } from '@shared/constants/modelOptions';
import { CopilotReviewResult, PullRequestDetails, PullRequestReviewer, PullRequestSummary, ReviewJob } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import { copyToClipboard } from '@renderer/utils/clipboard';
import { formatRunDate, formatReviewerStatus } from '../PullRequestDetail.helpers';
import styles from './SummaryTab.module.css';

interface SummaryTabProps {
  summary: PullRequestSummary;
  details: PullRequestDetails | null;
  detailsLoading: boolean;
  reviewRuns: { id: string; job: ReviewJob; result: CopilotReviewResult | null; runNumber: number }[];
}

export default function SummaryTab({ summary, details, detailsLoading, reviewRuns }: SummaryTabProps) {
  const reviewerGroups = (details?.reviewers ?? []).filter((r) => r.isContainer);
  const reviewerUsers = (details?.reviewers ?? []).filter((r) => !r.isContainer);

  const summaryTable = buildSummaryTable(reviewRuns);
  const sourceBranch = stripHeadsPrefix(summary.sourceRef);
  const targetBranch = stripHeadsPrefix(summary.targetRef);

  return (
    <div className={styles.summaryTab}>
      <div className={styles.summarySection}>
        <h4 className={styles.summarySectionTitle}>General information</h4>
        {detailsLoading ? (
          <div className="loading-block">
            <div className="loading-inline">Loading pull request info...</div>
            <div className="loading-bar" />
          </div>
        ) : (
          <div className={styles.detailInfoGrid}>
            <div className={`${styles.detailRow} ${styles.detailRowFull}`}><span>Author</span>{details?.author ?? summary.author}</div>
            <div className={styles.detailRow}>
              <span>Source branch</span>
              <div className={styles.branchRowValue}>
                <span>{sourceBranch}</span>
                <button
                  type="button"
                  className={styles.copyBranchBtn}
                  title="Copy source branch path"
                  aria-label="Copy source branch path"
                  onClick={() => {
                    void copyToClipboard(sourceBranch);
                  }}
                >
                  <i className="fa-regular fa-copy" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className={styles.detailRow}>
              <span>Target branch</span>
              <div className={styles.branchRowValue}>
                <span>{targetBranch}</span>
                <button
                  type="button"
                  className={styles.copyBranchBtn}
                  title="Copy target branch path"
                  aria-label="Copy target branch path"
                  onClick={() => {
                    void copyToClipboard(targetBranch);
                  }}
                >
                  <i className="fa-regular fa-copy" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className={styles.summarySection}>
        <div className={styles.summaryReviewersHeader}>
          <h4 className={styles.summarySectionTitle} style={{ margin: 0 }}>Reviewers</h4>
        </div>
        {detailsLoading ? (
          <div className="loading-block">
            <div className="loading-inline">Loading reviewers...</div>
            <div className="loading-bar" />
          </div>
        ) : !details?.reviewers || details.reviewers.length === 0 ? (
          <div className="empty">No reviewers.</div>
        ) : (
          <div className={styles.reviewersColumns}>
            <div className={styles.reviewerColumn}>
              <div className={styles.reviewerColumnHeader}>Groups</div>
              {reviewerGroups.length === 0 ? (
                <div className="empty">No groups.</div>
              ) : (
                <div className={styles.reviewersList}>
                  {reviewerGroups.map((reviewer) => (
                    <div key={reviewer.id ?? reviewer.name} className={styles.reviewerCard}>
                      <div className={styles.reviewerName}>{reviewer.name}</div>
                      <div className={styles.reviewerMeta}>
                        <span className={`badge ${getReviewerStatusClass(reviewer)}`}>{formatReviewerStatus(reviewer)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.reviewerColumn}>
              <div className={styles.reviewerColumnHeader}>Users</div>
              {reviewerUsers.length === 0 ? (
                <div className="empty">No users.</div>
              ) : (
                <div className={styles.reviewersList}>
                  {reviewerUsers.map((reviewer) => (
                    <div key={reviewer.id ?? reviewer.name} className={styles.reviewerCard}>
                      <div className={styles.reviewerName}>{reviewer.name}</div>
                      <div className={styles.reviewerMeta}>
                        <span className={`badge ${getReviewerStatusClass(reviewer)}`}>{formatReviewerStatus(reviewer)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.summarySection}>
        <h4 className={styles.summarySectionTitle}>Reviews summary</h4>
        {reviewRuns.length === 0 ? (
          <div className="empty">No review runs yet.</div>
        ) : summaryTable.rows.length === 0 ? (
          <div className="empty">No comments found across review runs.</div>
        ) : (
          <div className={styles.reviewsSummaryTableWrap}>
            <table className={styles.reviewsSummaryTable}>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Model</th>
                  <th>Date</th>
                  {summaryTable.severities.map((sev) => (
                    <th key={sev} className={styles.reviewsSummarySeverityCol}>
                      <span className={`badge severity ${getSeverityClass(sev)}`}>{sev}</span>
                    </th>
                  ))}
                  <th className={styles.reviewsSummarySeverityCol}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summaryTable.rows.map((row) => (
                  <tr key={row.runId}>
                    <td className={styles.reviewsSummaryRun}>{row.runNumberLabel}</td>
                    <td className={styles.reviewsSummaryModel}>{row.runModelLabel}</td>
                    <td className={styles.reviewsSummaryDate}>{row.runDateLabel}</td>
                    {row.counts.map((count, i) => (
                      <td key={summaryTable.severities[i]} className={styles.reviewsSummaryCount}>
                        {count > 0 ? count : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td className={`${styles.reviewsSummaryCount} ${styles.reviewsSummaryTotal}`}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function stripHeadsPrefix(branch: string): string {
  return branch.replace(/^refs\/heads\//, '');
}

function getReviewerStatusClass(reviewer: PullRequestReviewer): string {
  const vote = reviewer.vote ?? 0;
  if (vote >= 5) {
    return 'status-approved';
  }
  if (vote <= -10) {
    return 'status-rejected';
  }
  if (vote === -5) {
    return 'status-waiting';
  }
  return '';
}

function buildSummaryTable(reviewRuns: { id: string; job: ReviewJob; result: CopilotReviewResult | null; runNumber: number }[]) {
  const allSeverities = new Set<string>();
  for (const run of reviewRuns) {
    for (const comment of run.result?.comments ?? []) {
      allSeverities.add(comment.severity ?? 'Unknown');
    }
  }
  const severities = [...allSeverities].sort();

  const rows = reviewRuns
    .map((run) => {
      const severityMap = new Map<string, number>();
      for (const comment of run.result?.comments ?? []) {
        const severity = comment.severity ?? 'Unknown';
        severityMap.set(severity, (severityMap.get(severity) ?? 0) + 1);
      }
      const counts = severities.map((sev) => severityMap.get(sev) ?? 0);
      const total = counts.reduce((acc, c) => acc + c, 0);
      return {
        runId: run.id,
        runNumberLabel: `Run ${run.runNumber}`,
        runModelLabel: getModelDisplayName(run.job.modelName),
        runDateLabel: formatRunDate(run.job),
        counts,
        total
      };
    })
    .filter((row) => row.total > 0);

  return { severities, rows };
}
