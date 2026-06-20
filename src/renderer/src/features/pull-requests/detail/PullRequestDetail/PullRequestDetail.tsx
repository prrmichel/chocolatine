import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CopilotReviewResult,
  PullRequestDetails,
  PullRequestFileDiff,
  PullRequestSummary,
  PullRequestThread,
  PullRequestWorkItem,
  ReviewJob
} from '@shared/types/models';
import { parseReview } from '@renderer/utils/parseReview';
import { getTaskType } from '@renderer/utils/severity';
import { arePathsEquivalent, buildCommentReadKey, findLineByEvidence, getDisplayedNewLineInfo, normalizePath } from './PullRequestDetail.helpers';
import { api } from '@renderer/services/api';
import { useLocalStorageRecord } from '@renderer/hooks/useLocalStorageRecord';
import type { ReviewCommentEntry } from './ChangesTab/ChangesTab.types';
import SummaryTab from './SummaryTab/SummaryTab';
import ChangesTab from './ChangesTab/ChangesTab';
import WorkItemsTab from './WorkItemsTab/WorkItemsTab';
import ReviewsTab from './ReviewsTab/ReviewsTab';
import FollowUpTab from './FollowUpTab/FollowUpTab';
import UserCommentsTab from './UserCommentsTab/UserCommentsTab';
import styles from './PullRequestDetail.module.css';
import { LABELS } from './PullRequestDetail.messages';

interface PullRequestDetailProps {
  summary?: PullRequestSummary | null;
  details?: PullRequestDetails | null;
  diffs: PullRequestFileDiff[];
  workItems: PullRequestWorkItem[];
  prThreads: PullRequestThread[];
  reviewJobs: ReviewJob[];
  defaultDiffViewMode?: 'inline' | 'side';
  selectedDiffPath?: string | null;
  detailsLoading: boolean;
  workItemsLoading: boolean;
  diffsLoading: boolean;
  modelName: string;
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  onModelChange: (value: string) => void;
  promptLibrary: import('@shared/types/models').PromptLibrarySettings | null;
  selectedPromptId: string | null;
  customInstructions: string;
  excludedFilePatterns: string;
  onSelectedPromptIdChange: (id: string) => void;
  onCustomInstructionsChange: (value: string) => void;
  onExcludedFilePatternsChange: (value: string) => void;
  onSelectDiff: (path: string) => void;
  onQueueReview: (overrideModel?: string, forceNewSession?: boolean, selectedSkillIds?: string[], overridePromptId?: string, reviewSessionOptions?: import('@shared/types/models').ReviewSessionOptions) => void;
  currentProjectKeys?: string[];
  currentOrganizationId?: string | null;
  onReloadDetails: () => Promise<void>;
  onReloadThreads: () => Promise<void>;
  onOpenPullRequest: () => void;
  onOpenWorkItem: (id: number) => void;
  onAssignToSelf: () => Promise<void>;
  workItemsSummaryLoading: boolean;
  workItemsSummaryText: string;
  workItemsSummaryModelName: string;
  onWorkItemsSummaryModelChange: (value: string) => void;
  workItemsPromptLibrary: import('@shared/types/models').PromptLibrarySettings | null;
  workItemsSelectedPromptId: string | null;
  onWorkItemsSelectedPromptIdChange: (id: string) => void;
  workItemsSummaryPromptExtra: string;
  onWorkItemsSummaryPromptExtraChange: (value: string) => void;
  onGenerateWorkItemsSummary: () => void;
  onDeleteReviewRuns: (jobId?: string | null) => void;
  onError?: (message: string) => void;
}

type DetailTab = 'summary' | 'changes' | 'work-items' | 'reviews' | 'follow-up' | 'user-comments';

export default function PullRequestDetail({
  summary,
  details,
  diffs,
  workItems,
  prThreads,
  reviewJobs,
  defaultDiffViewMode,
  selectedDiffPath,
  detailsLoading,
  workItemsLoading,
  diffsLoading,
  modelName,
  modelOptions,
  onModelChange,
  promptLibrary,
  selectedPromptId,
  customInstructions,
  excludedFilePatterns,
  onSelectedPromptIdChange,
  onCustomInstructionsChange,
  onExcludedFilePatternsChange,
  onSelectDiff,
  onQueueReview,
  currentProjectKeys,
  currentOrganizationId,
  onReloadDetails,
  onReloadThreads,
  onOpenPullRequest,
  onOpenWorkItem,
  onAssignToSelf,
  workItemsSummaryLoading,
  workItemsSummaryText,
  workItemsSummaryModelName,
  onWorkItemsSummaryModelChange,
  workItemsPromptLibrary,
  workItemsSelectedPromptId,
  onWorkItemsSelectedPromptIdChange,
  workItemsSummaryPromptExtra,
  onWorkItemsSummaryPromptExtraChange,
  onGenerateWorkItemsSummary,
  onDeleteReviewRuns,
  onError
}: PullRequestDetailProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>('summary');
  const [collapsedRunIds, setCollapsedRunIds] = useState<Set<string>>(new Set());
  const [pendingFollowUpContextId, setPendingFollowUpContextId] = useState<string | null>(null);
  const [changesFollowUpPanelOpen, setChangesFollowUpPanelOpen] = useState(false);
  const [changesFollowUpPanelHeight, setChangesFollowUpPanelHeight] = useState(450);
  const [sentComments, setSentComments] = useState<Record<string, string>>({});
  const [updatingThreadIds, setUpdatingThreadIds] = useState<number[]>([]);
  const pendingScrollRef = useRef<number | null>(null);
  const sentCommentsHydratedRef = useRef(false);
  const isDraft = details?.isDraft ?? summary?.isDraft ?? false;

  const readStateStorageKey = summary ? `pr-review-read-comments-v1:${summary.id}` : null;
  const favoriteStateStorageKey = summary ? `pr-review-favorite-comments-v1:${summary.id}` : null;
  const threadReadStorageKey = summary ? `pr-user-comments-read-v1:${summary.id}` : null;
  const sentCommentStateStorageKey = summary ? `pr-ado-sent-comments-v1:${summary.id}` : null;

  const readComments = useLocalStorageRecord(readStateStorageKey);
  const favoriteComments = useLocalStorageRecord(favoriteStateStorageKey);
  const readThreads = useLocalStorageRecord(threadReadStorageKey);

  const reviewRuns = useMemo(() => {
    if (!summary) return [] as { id: string; job: ReviewJob; result: CopilotReviewResult | null; runNumber: number }[];
    const scoped = reviewJobs
      .filter((job) => job.pullRequest.id === summary.id)
      .filter((job) => getTaskType(job) === 'Code review')
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.completedAt ?? a.startedAt ?? a.queuedAt).getTime();
        const bTime = new Date(b.completedAt ?? b.startedAt ?? b.queuedAt).getTime();
        return bTime - aTime;
      });
    return scoped.map((job, index) => ({
      id: job.id,
      job,
      result: parseReview(job),
      runNumber: scoped.length - index
    }));
  }, [reviewJobs, summary]);

  const summaryRuns = useMemo(() => {
    if (!summary) return [] as ReviewJob[];
    return reviewJobs
      .filter((job) => job.pullRequest.id === summary.id)
      .filter((job) => getTaskType(job) === 'Changes summary')
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.completedAt ?? a.startedAt ?? a.queuedAt).getTime();
        const bTime = new Date(b.completedAt ?? b.startedAt ?? b.queuedAt).getTime();
        return bTime - aTime;
      });
  }, [reviewJobs, summary]);

  const selectedDiff = useMemo(
    () => diffs.find((diff) => diff.path === selectedDiffPath) ?? diffs[0],
    [diffs, selectedDiffPath]
  );

  const allFileComments = useMemo(() => {
    const map = new Map<number, ReviewCommentEntry[]>();
    if (!selectedDiff) return map;

    const selectedNorm = normalizePath(selectedDiff.path);
    const lineInfo = getDisplayedNewLineInfo(selectedDiff.diffText ?? '');

    for (const run of reviewRuns) {
      for (const [commentIndex, comment] of (run.result?.comments ?? []).entries()) {
        if (!comment.file) continue;
        const commentNorm = normalizePath(comment.file);
        if (commentNorm !== selectedNorm
          && !commentNorm.endsWith(`/${selectedNorm}`)
          && !selectedNorm.endsWith(`/${commentNorm}`)) continue;

        const parsedLine = Number(comment.lineNew);
        const hasExactLine = Number.isFinite(parsedLine) && parsedLine > 0 && lineInfo.displayedNewLines.has(parsedLine);
        const evidenceMatchedLine = hasExactLine ? null : findLineByEvidence(comment.evidence, lineInfo.displayedLines);
        const lineNew = hasExactLine
          ? parsedLine
          : evidenceMatchedLine ?? (Number.isFinite(parsedLine) && parsedLine > 0 ? parsedLine : lineInfo.firstDisplayedNewLine);
        const isFallbackPlacement = !hasExactLine && !evidenceMatchedLine;

        const existing = map.get(lineNew) ?? [];
        existing.push({
          comment,
          runNumber: run.runNumber,
          runId: run.id,
          commentKey: buildCommentReadKey(run.id, comment, commentIndex),
          isFallbackPlacement
        });
        map.set(lineNew, existing);
      }
    }
    return map;
  }, [reviewRuns, selectedDiff]);

  const collapsedRunsDbKey = summary ? `prRunCollapsed:${summary.id}` : null;

  useEffect(() => {
    if (!collapsedRunsDbKey) { setCollapsedRunIds(new Set()); return; }
    api.getUIPref(collapsedRunsDbKey).then((raw) => {
      try {
        const ids: string[] = raw ? JSON.parse(raw) : [];
        setCollapsedRunIds(new Set(Array.isArray(ids) ? ids : []));
      } catch { setCollapsedRunIds(new Set()); }
    }).catch(() => setCollapsedRunIds(new Set()));
  }, [collapsedRunsDbKey]);

  useEffect(() => {
    sentCommentsHydratedRef.current = false;
    if (!sentCommentStateStorageKey) {
      setSentComments({});
      sentCommentsHydratedRef.current = true;
      return;
    }

    api.getUIPref(sentCommentStateStorageKey).then((raw) => {
      try {
        const parsed = raw ? JSON.parse(raw) : {};
        setSentComments(parsed && typeof parsed === 'object' ? parsed as Record<string, string> : {});
      } catch {
        setSentComments({});
      } finally {
        sentCommentsHydratedRef.current = true;
      }
    }).catch(() => {
      setSentComments({});
      sentCommentsHydratedRef.current = true;
    });
  }, [sentCommentStateStorageKey]);

  useEffect(() => {
    if (!sentCommentStateStorageKey || !sentCommentsHydratedRef.current) {
      return;
    }
    const serialized = Object.keys(sentComments).length > 0 ? JSON.stringify(sentComments) : null;
    void api.setUIPref(sentCommentStateStorageKey, serialized);
  }, [sentComments, sentCommentStateStorageKey]);

  const toggleRunCollapsed = (runId: string) => {
    setCollapsedRunIds((prev) => {
      const next = new Set(prev);
      if (next.has(runId)) next.delete(runId); else next.add(runId);
      if (collapsedRunsDbKey) {
        void api.setUIPref(collapsedRunsDbKey, JSON.stringify(Array.from(next)));
      }
      return next;
    });
  };

  const isCommentRead = readComments.has;
  const toggleCommentRead = readComments.toggle;
  const markCommentsRead = readComments.setKeys;
  const markCommentsUnread = readComments.removeKeys;

  const isCommentFavorite = favoriteComments.has;
  const toggleCommentFavorite = favoriteComments.toggle;

  const isThreadRead = (threadId: number) => readThreads.has(String(threadId));
  const toggleThreadRead = (threadId: number) => readThreads.toggle(String(threadId));
  const markThreadsRead = (ids: number[]) => readThreads.setKeys(ids.map(String));
  const markThreadsUnread = (ids: number[]) => readThreads.removeKeys(ids.map(String));
  const getCommentSentAt = (commentKey: string) => sentComments[commentKey] ?? null;
  const markCommentSent = async (commentKey: string, sentAt: string) => {
    setSentComments((prev) => ({
      ...prev,
      [commentKey]: sentAt
    }));
  };
  const isThreadStatusUpdating = useCallback((threadId: number) => updatingThreadIds.includes(threadId), [updatingThreadIds]);
  const toggleThreadResolved = useCallback(async (thread: PullRequestThread) => {
    const repositoryId = details?.repositoryId ?? null;
    const pullRequestId = summary?.id ?? null;
    if (!repositoryId || !pullRequestId) {
      onError?.('The pull request details are still loading. Wait a moment and try again.');
      return;
    }
    if (updatingThreadIds.includes(thread.id)) {
      return;
    }

    setUpdatingThreadIds((prev) => [...prev, thread.id]);
    try {
      await api.updatePullRequestThreadStatus({
        repositoryId,
        pullRequestId,
        threadId: thread.id,
        status: thread.isResolved ? 'active' : 'resolved'
      });
      await onReloadThreads();
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Unable to update the pull request comment.');
    } finally {
      setUpdatingThreadIds((prev) => prev.filter((id) => id !== thread.id));
    }
  }, [details?.repositoryId, onError, onReloadThreads, summary?.id, updatingThreadIds]);

  const handleOpenFollowUpFromComment = async (runId: string) => {
    const job = reviewJobs.find((j) => j.id === runId);
    if (!job) return;
    await handleOpenFollowUp(job);
  };

  const navigateToLine = (file: string, line?: number) => {
    const matchingDiff = diffs.find(d => arePathsEquivalent(d.path, file));
    if (matchingDiff) onSelectDiff(matchingDiff.path);
    pendingScrollRef.current = line ?? null;
    setDetailTab('changes');
  };

  const navigateToReviews = () => setDetailTab('reviews');

  const handleOpenFollowUp = async (job: ReviewJob) => {
    try {
      const ctx = await api.createFollowUpContext(job);
      setPendingFollowUpContextId(ctx.id);
      setDetailTab('follow-up');
    } catch (err) {
      console.error('Failed to create follow-up context', err);
    }
  };

  useEffect(() => {
    setPendingFollowUpContextId(null);
  }, [summary?.id]);

  useEffect(() => {
    if (detailTab === 'changes' && pendingScrollRef.current !== null) {
      const targetLine = pendingScrollRef.current;
      pendingScrollRef.current = null;
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-line-new="${targetLine}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('diff-line-highlight');
          setTimeout(() => el.classList.remove('diff-line-highlight'), 2000);
        }
      });
    }
  }, [detailTab, selectedDiffPath]);

  return (
    <section className={`panel ${styles.detail}`}>
      <div className={`panel-header ${styles.detailHeader}`}>
        <div className={styles.detailHeaderLeft}>
          <span className={`row ${styles.detailTitle}`}>
            {details?.title ?? summary?.title ?? LABELS.detailsHeader}
            {isDraft && <span className="badge draft">{LABELS.draft}</span>}
          </span>
        </div>
        <div className={styles.detailHeaderRight}>
          <button
            className="btn"
            onClick={() => {
              void onAssignToSelf();
            }}
            disabled={!summary}
            aria-label={LABELS.assignMyself}
            title={LABELS.assignMyself}
          >
            <i className="fa-solid fa-user-plus" aria-hidden="true" />
          </button>
          <button
            className="btn"
            onClick={() => {
              if (workItems.length > 0) {
                onOpenWorkItem(workItems[0].id);
              }
            }}
            disabled={!summary || workItems.length === 0}
            aria-label={LABELS.openWorkItem}
            title={LABELS.openWorkItem}
          >
            <i className="fa-solid fa-list-check" aria-hidden="true" />
          </button>
          <button className="btn" onClick={() => { void onReloadDetails(); }} disabled={!summary} aria-label={LABELS.reload} title={LABELS.reload}>
            <i className="fa-solid fa-rotate-right" aria-hidden="true" />
          </button>
          <button className="btn" onClick={onOpenPullRequest} disabled={!summary} aria-label={LABELS.openPullRequest} title={LABELS.openPullRequest}>
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" />
          </button>
        </div>
      </div>

      {!summary ? (
        <div className="empty">{LABELS.emptyState}</div>
      ) : (
        <div className={styles.detailSections}>
          <div className={styles.detailBlockTabs}>
            <div className={styles.detailTabsDocked}>
              <div className="detail-subtabs">
                {(['summary', 'work-items', 'changes', 'user-comments', 'reviews', 'follow-up'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`detail-subtab ${detailTab === tab ? 'active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab === 'summary' && LABELS.tabSummary}
                    {tab === 'work-items' && <>{LABELS.tabWorkItems} <span className="list-badge review-count">{workItems.length}</span></>}
                    {tab === 'changes' && <>{LABELS.tabChanges} <span className="list-badge review-count">{diffs.length}</span></>}
                    {tab === 'user-comments' && <>{LABELS.tabUserComments} <span className="list-badge review-count">{prThreads.length}</span></>}
                    {tab === 'reviews' && <>{LABELS.tabReviews} <span className="list-badge review-count">{reviewRuns.length}</span></>}
                    {tab === 'follow-up' && LABELS.tabFollowUp}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.detailTabContent}>
              {detailTab === 'summary' && (
                <SummaryTab
                  summary={summary}
                  details={details ?? null}
                  detailsLoading={detailsLoading}
                  reviewRuns={reviewRuns}
                />
              )}

              {detailTab === 'changes' && (
                <ChangesTab
                  diffs={diffs}
                  prThreads={prThreads}
                  reviewRuns={reviewRuns.map((run) => ({
                    id: run.id,
                    runNumber: run.runNumber,
                    modelName: run.job.modelName,
                    result: run.result
                  }))}
                  defaultDiffViewMode={defaultDiffViewMode}
                  selectedDiffPath={selectedDiffPath ?? null}
                  diffsLoading={diffsLoading}
                  allFileComments={allFileComments}
                  onSelectDiff={onSelectDiff}
                  onNavigateToReviews={navigateToReviews}
                  isCommentRead={isCommentRead}
                  onToggleCommentRead={toggleCommentRead}
                  isCommentFavorite={isCommentFavorite}
                  onToggleCommentFavorite={toggleCommentFavorite}
                  onOpenFollowUpFromComment={handleOpenFollowUpFromComment}
                  onMarkCommentsRead={markCommentsRead}
                  onMarkCommentsUnread={markCommentsUnread}
                  isThreadRead={isThreadRead}
                  onToggleThreadRead={toggleThreadRead}
                  onToggleThreadResolved={toggleThreadResolved}
                  isThreadStatusUpdating={isThreadStatusUpdating}
                  pullRequest={summary}
                  pullRequestRepositoryId={details?.repositoryId ?? null}
                  reviewJobs={reviewRuns.map((r) => r.job)}
                  modelOptions={modelOptions}
                  followUpPanelOpen={changesFollowUpPanelOpen}
                  followUpPanelHeight={changesFollowUpPanelHeight}
                  onFollowUpPanelOpenChange={setChangesFollowUpPanelOpen}
                  onFollowUpPanelHeightChange={setChangesFollowUpPanelHeight}
                  onRefreshThreads={onReloadThreads}
                  getCommentSentAt={getCommentSentAt}
                  onMarkCommentSent={markCommentSent}
                />
              )}

              {detailTab === 'user-comments' && (
                <UserCommentsTab
                  threads={prThreads}
                  isThreadRead={isThreadRead}
                  onToggleThreadRead={toggleThreadRead}
                  onToggleThreadResolved={toggleThreadResolved}
                  isThreadStatusUpdating={isThreadStatusUpdating}
                  onMarkThreadsRead={markThreadsRead}
                  onMarkThreadsUnread={markThreadsUnread}
                  onNavigateToLine={navigateToLine}
                />
              )}

              {detailTab === 'work-items' && (
                <WorkItemsTab
                  pullRequestId={summary?.id}
                  workItems={workItems}
                  workItemsLoading={workItemsLoading}
                  modelOptions={modelOptions}
                  workItemsSummaryModelName={workItemsSummaryModelName}
                  workItemsSummaryLoading={workItemsSummaryLoading}
                  workItemsSummaryText={workItemsSummaryText}
                  promptLibrary={workItemsPromptLibrary}
                  selectedPromptId={workItemsSelectedPromptId}
                  workItemsSummaryPromptExtra={workItemsSummaryPromptExtra}
                  summaryRuns={summaryRuns}
                  hasSummary={!!summary}
                  onOpenWorkItem={onOpenWorkItem}
                  onWorkItemsSummaryModelChange={onWorkItemsSummaryModelChange}
                  onSelectedPromptIdChange={onWorkItemsSelectedPromptIdChange}
                  onWorkItemsSummaryPromptExtraChange={onWorkItemsSummaryPromptExtraChange}
                  onGenerateWorkItemsSummary={onGenerateWorkItemsSummary}
                  onDeleteSummaryRun={async (jobId) => onDeleteReviewRuns(jobId)}
                />
              )}

              {detailTab === 'reviews' && (
                <ReviewsTab
                  summary={summary ?? null}
                  reviewRuns={reviewRuns}
                  modelName={modelName}
                  modelOptions={modelOptions}
                  promptLibrary={promptLibrary}
                  selectedPromptId={selectedPromptId}
                  customInstructions={customInstructions}
                  excludedFilePatterns={excludedFilePatterns}
                  hasSummary={!!summary}
                  diffsLoading={diffsLoading}
                  readCommentKeys={readComments.record}
                  collapsedRunIds={collapsedRunIds}
                  onModelChange={onModelChange}
                  onSelectedPromptIdChange={onSelectedPromptIdChange}
                  onCustomInstructionsChange={onCustomInstructionsChange}
                  onExcludedFilePatternsChange={onExcludedFilePatternsChange}
                  onQueueReview={onQueueReview}
                  currentProjectKeys={currentProjectKeys}
                  currentOrganizationId={currentOrganizationId}
                  onDeleteReviewRuns={onDeleteReviewRuns}
                  onNavigateToLine={navigateToLine}
                  onToggleCommentRead={toggleCommentRead}
                  onMarkCommentsRead={markCommentsRead}
                  onMarkCommentsUnread={markCommentsUnread}
                  onToggleRunCollapsed={toggleRunCollapsed}
                  onOpenFollowUp={handleOpenFollowUp}
                />
              )}

              {detailTab === 'follow-up' && summary && (
                <FollowUpTab
                  pullRequest={summary}
                  reviewJobs={reviewRuns.map((r) => r.job)}
                  modelOptions={modelOptions}
                  pendingContextId={pendingFollowUpContextId}
                  onPendingContextHandled={() => setPendingFollowUpContextId(null)}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
