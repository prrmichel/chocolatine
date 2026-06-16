import { useState, useMemo, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { matchesSkillProjectKeyCandidates } from '@shared/utils/skillProjectKey';
import { CopilotReviewResult, PromptLibrarySettings, PullRequestSummary, ReviewJob, ReviewSessionOptions, ReviewWorktreeStatus, SkillInfo } from '@shared/types/models';
import { api } from '@renderer/services/api';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import { useUIStore } from '@renderer/stores/app/useUIStore';
import { getSeverityClass } from '@renderer/utils/severity';
import { copyToClipboard } from '@renderer/utils/clipboard';
import { formatRunDate, formatSeverityFilterLabel, buildCommentReadKey } from '../PullRequestDetail.helpers';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import CopyButton from '@renderer/features/shared/CopyButton/CopyButton';
import PromptPreviewModal, { PromptPreviewData } from '@renderer/features/shared/PromptPreviewModal/PromptPreviewModal';
import ReviewOptionsModal from '@renderer/features/shared/ReviewOptionsModal';
import RunHeader from './RunHeader';
import RunResult from './RunResult';
import { LABELS, runSelectLabel, executedPromptTitle, severityFilterLabel } from './ReviewsTab.messages';
import styles from './ReviewsTab.module.css';

interface ReviewRun {
  id: string;
  job: ReviewJob;
  result: CopilotReviewResult | null;
  runNumber: number;
}

interface ReviewsTabProps {
  summary?: PullRequestSummary | null;
  reviewRuns: ReviewRun[];
  modelName: string;
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  promptLibrary: PromptLibrarySettings | null;
  selectedPromptId: string | null;
  customInstructions: string;
  excludedFilePatterns: string;
  hasSummary: boolean;
  diffsLoading: boolean;
  readCommentKeys: Record<string, true>;
  collapsedRunIds: Set<string>;
  onModelChange: (value: string) => void;
  onSelectedPromptIdChange: (id: string) => void;
  onCustomInstructionsChange: (value: string) => void;
  onExcludedFilePatternsChange: (value: string) => void;
  onQueueReview: (overrideModel?: string, forceNewSession?: boolean, selectedSkillIds?: string[], overridePromptId?: string, reviewSessionOptions?: ReviewSessionOptions) => void;
  onDeleteReviewRuns: (jobId?: string | null) => void;
  onNavigateToLine: (file: string, line?: number) => void;
  onToggleCommentRead: (commentKey: string) => void;
  onMarkCommentsRead: (keys: string[]) => void;
  onMarkCommentsUnread: (keys: string[]) => void;
  onToggleRunCollapsed: (runId: string) => void;
  onOpenFollowUp?: (job: ReviewJob) => void;
  currentProjectKeys?: string[];
  currentOrganizationId?: string | null;
}

export default function ReviewsTab({
  summary,
  reviewRuns,
  modelName,
  modelOptions,
  promptLibrary,
  selectedPromptId,
  customInstructions,
  excludedFilePatterns,
  hasSummary,
  diffsLoading,
  readCommentKeys,
  collapsedRunIds,
  onModelChange,
  onSelectedPromptIdChange,
  onCustomInstructionsChange,
  onExcludedFilePatternsChange,
  onQueueReview,
  onDeleteReviewRuns,
  onNavigateToLine,
  onToggleCommentRead,
  onMarkCommentsRead,
  onMarkCommentsUnread,
  onToggleRunCollapsed,
  onOpenFollowUp,
  currentProjectKeys = [],
  currentOrganizationId
}: ReviewsTabProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>('all');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string | null>(null);
  const [storedSkills, setStoredSkills] = useState<SkillInfo[]>([]);
  const [worktreeStatus, setWorktreeStatus] = useState<ReviewWorktreeStatus | null>(null);
  const [promptPreview, setPromptPreview] = useState<PromptPreviewData | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ all: boolean; jobId: string | null } | null>(null);
  const customInstructionsRef = useRef<HTMLTextAreaElement | null>(null);
  const settings = useSettingsStore((state) => state.settings);
  const openSettings = useUIStore((state) => state.openSettings);
  const reviewWorktreeRootFolder = settings?.reviewStorage?.folderPath?.trim() ?? '';
  const isModelCatalogReady = modelOptions.length > 0;
  const hasReviewPrompt = useMemo(
    () => (promptLibrary?.prompts ?? []).some((prompt) => (prompt.category ?? 'PR Review') === 'PR Review'),
    [promptLibrary]
  );

  // Review options modal state
  const [reviewOptionsOpen, setReviewOptionsOpen] = useState(false);

  const openReviewOptions = useCallback(() => {
    setReviewOptionsOpen(true);
  }, []);

  const handleReviewOptionsConfirm = useCallback((opts: {
    model: string;
    promptId: string;
    forceNewSession: boolean;
    selectedSkillIds: string[] | undefined;
    reviewSessionOptions?: ReviewSessionOptions;
  }) => {
    onModelChange(opts.model);
    onSelectedPromptIdChange(opts.promptId);
    const promptId = opts.promptId || undefined;
    onQueueReview(opts.model, opts.forceNewSession, opts.selectedSkillIds, promptId, opts.reviewSessionOptions);
    setReviewOptionsOpen(false);
  }, [onQueueReview, onModelChange, onSelectedPromptIdChange]);


  useEffect(() => {
    const textarea = customInstructionsRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 300);
    textarea.style.height = `${Math.max(34, nextHeight)}px`;
  }, [customInstructions]);

  useEffect(() => {
    let isMounted = true;

    api.getSkills()
      .then((skills) => {
        if (isMounted) {
          setStoredSkills(skills ?? []);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStoredSkills([]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!summary) {
      setWorktreeStatus(null);
      return;
    }

    let isMounted = true;
    api.getReviewWorktreeStatus(summary)
      .then((status) => {
        if (isMounted) {
          setWorktreeStatus(status ?? buildInitialWorktreeStatus(summary, reviewWorktreeRootFolder));
        }
      })
      .catch(() => {
        if (isMounted) {
          setWorktreeStatus(buildInitialWorktreeStatus(summary, reviewWorktreeRootFolder));
        }
      });

    return () => {
      isMounted = false;
    };
  }, [reviewWorktreeRootFolder, summary]);

  useEffect(() => {
    if (!summary) {
      return () => {};
    }

    return api.onReviewWorktreeChanged((status) => {
      if (status.pullRequestId === summary.id && status.repository === summary.repository) {
        setWorktreeStatus(status);
      }
    });
  }, [summary]);

  const storedSkillNamesByMarker = useMemo(() => {
    const relevantSkills = storedSkills.filter((skill) => (
      skill.scope === 'project'
        ? currentProjectKeys.length === 0 || matchesSkillProjectKeyCandidates(skill.projectKey, currentProjectKeys)
        : !skill.linkedOrganizationIds?.length || !currentOrganizationId || skill.linkedOrganizationIds.includes(currentOrganizationId)
    ));

    return new Map(relevantSkills.map((skill) => [skill.marker, skill.name]));
  }, [currentOrganizationId, currentProjectKeys, storedSkills]);

  const isCommentRead = (commentKey: string) => Boolean(readCommentKeys[commentKey]);

  const selectedRun = useMemo(
    () => (selectedRunId && selectedRunId !== 'all'
      ? reviewRuns.find((run) => run.id === selectedRunId) ?? reviewRuns[0] ?? null
      : null),
    [reviewRuns, selectedRunId]
  );

  const filterBySeverity = useCallback((items: import('@shared/types/models').CopilotReviewComment[]) => {
    if (!selectedSeverityFilter) return items;
    return items.filter((item) => item.severity && getSeverityClass(item.severity) === selectedSeverityFilter);
  }, [selectedSeverityFilter]);

  const comments = filterBySeverity(selectedRun?.result?.comments ?? []);

  const visibleRuns = useMemo(() =>
    reviewRuns
      .map((run) => ({
        ...run,
        filteredComments: filterBySeverity(run.result?.comments ?? [])
      }))
      .filter((run) => {
        if (run.job.status === 'Queued' || run.job.status === 'Running') return true;
        return !selectedSeverityFilter || run.filteredComments.length > 0;
      }),
    [filterBySeverity, reviewRuns, selectedSeverityFilter]
  );

  const visibleCommentKeys = useMemo(() => {
    if (selectedRunId === 'all') {
      return visibleRuns.flatMap((run) =>
        run.filteredComments.map((c, i) => buildCommentReadKey(run.id, c, i))
      );
    }
    if (selectedRun) {
      return comments.map((c, i) => buildCommentReadKey(selectedRun.id, c, i));
    }
    return [];
  }, [selectedRunId, visibleRuns, selectedRun, comments]);

  const openPromptPreview = (run: ReviewRun) => {
    setPromptPreview({
      mode: 'accordion',
      title: executedPromptTitle(run.runNumber),
      job: run.job
    });
  };

  const getMarkReadHandler = (run: ReviewRun, filteredComments?: import('@shared/types/models').CopilotReviewComment[]) => () => {
    const cmts = filteredComments ?? run.result?.comments ?? [];
    const keys = cmts.map((c, i) => buildCommentReadKey(run.id, c, i));
    onMarkCommentsRead(keys);
    if (!collapsedRunIds.has(run.id)) onToggleRunCollapsed(run.id);
  };

  const getMarkUnreadHandler = (run: ReviewRun, filteredComments?: import('@shared/types/models').CopilotReviewComment[]) => () => {
    const cmts = filteredComments ?? run.result?.comments ?? [];
    const keys = cmts.map((c, i) => buildCommentReadKey(run.id, c, i));
    onMarkCommentsUnread(keys);
    if (collapsedRunIds.has(run.id)) onToggleRunCollapsed(run.id);
  };

  const handlePreloadBranchContext = useCallback(async () => {
    if (!summary) {
      return;
    }

    setWorktreeStatus((current) => ({
      ...(current ?? buildUnavailableStatus(summary, LABELS.branchContextPreparing)),
      state: 'refreshing',
      statusMessage: LABELS.branchContextPreparing,
      errorMessage: null,
      updatedAt: new Date().toISOString()
    }));

    try {
      const status = await api.preloadReviewWorktree(summary);
      setWorktreeStatus(status ?? buildUnavailableStatus(summary, LABELS.branchContextUnavailable));
    } catch {
      setWorktreeStatus(buildUnavailableStatus(summary, LABELS.branchContextUnavailable));
    }
  }, [summary]);

  const effectiveWorktreeStatus = worktreeStatus ?? (summary ? buildInitialWorktreeStatus(summary, reviewWorktreeRootFolder) : null);
  const isBranchContextBlocked = effectiveWorktreeStatus?.state === 'blocked';
  const worktreeActionLabel = effectiveWorktreeStatus?.state === 'ready'
    ? LABELS.refreshBranchContext
    : LABELS.prepareBranchContext;

  return (
    <div className={styles.reviewTab}>
      <div className={styles.reviewToolbar}>
        <div className={styles.reviewToolbarTop}>
          <div className={styles.detailReviewHeader}>
            <label className={styles.reviewSelector}>
              <select
                value={selectedRun?.id ?? ''}
                onChange={(event) => setSelectedRunId(event.target.value)}
                disabled={reviewRuns.length === 0}
              >
                {reviewRuns.length === 0 ? (
                  <option value="">{LABELS.noRuns}</option>
                ) : (
                  <>
                    <option value="all">{LABELS.allRuns}</option>
                    {reviewRuns.map((run) => (
                      <option key={run.id} value={run.id}>
                        {runSelectLabel(run.runNumber, getModelDisplayName(run.job.modelName), formatRunDate(run.job))}{run.job.batchLabel ? ` - ${run.job.batchLabel}` : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>
            {selectedSeverityFilter && (
              <button className="btn" onClick={() => setSelectedSeverityFilter(null)} title={LABELS.clearSeverityFilter}>
                {severityFilterLabel(formatSeverityFilterLabel(selectedSeverityFilter))}
              </button>
            )}
            {selectedRun?.job.reviewResponse && (
              <button className="btn" onClick={() => { void copyToClipboard(selectedRun.job.reviewResponse ?? ''); }}>{LABELS.copyRawResponse}</button>
            )}
            <button
              className="btn btn-danger"
              onClick={() => {
                const deletingAll = selectedRunId === 'all';
                setDeleteConfirm({ all: deletingAll, jobId: deletingAll ? null : (selectedRun?.job.id ?? null) });
              }}
              disabled={!hasSummary || (selectedRunId !== 'all' && !selectedRun)}
              aria-label={LABELS.deleteReviewRuns}
              title={selectedRunId === 'all' ? LABELS.deleteAllRunsTitle : LABELS.deleteSelectedRunTitle}
            >
              <i className="fa-solid fa-trash" aria-hidden="true" />
            </button>
            <button
              className="btn"
              onClick={() => onMarkCommentsRead(visibleCommentKeys)}
              disabled={visibleCommentKeys.length === 0}
              aria-label={LABELS.markAllReadLabel}
              title={selectedRunId === 'all' ? LABELS.markAllReadTitleAll : LABELS.markAllReadTitleSingle}
            >
              <i className="fa-solid fa-envelope-open" aria-hidden="true" />
            </button>
            <button
              className="btn"
              onClick={() => onMarkCommentsUnread(visibleCommentKeys)}
              disabled={visibleCommentKeys.length === 0}
              aria-label={LABELS.markAllUnreadLabel}
              title={selectedRunId === 'all' ? LABELS.markAllUnreadTitleAll : LABELS.markAllUnreadTitleSingle}
            >
              <i className="fa-solid fa-envelope" aria-hidden="true" />
            </button>
          </div>

          <div className={styles.reviewTabActions}>
            <button
              className="btn accent"
              onClick={() => openReviewOptions()}
              disabled={!hasSummary || diffsLoading || !isModelCatalogReady || !hasReviewPrompt}
              aria-label={LABELS.queueReview}
              title={
                !hasReviewPrompt
                  ? LABELS.queueReviewPromptRequired
                  : (!isModelCatalogReady ? LABELS.modelCatalogUnavailable : (diffsLoading ? LABELS.loadingChanges : LABELS.queueReview))
              }
            >
              <i className={`fa-solid ${diffsLoading ? 'fa-spinner fa-spin' : 'fa-play'}`} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className={styles.customInstructions}>
          <textarea
            ref={customInstructionsRef}
            className={styles.customInstructionsInput}
            placeholder={LABELS.customInstructionsPlaceholder}
            value={customInstructions}
            onChange={(event) => onCustomInstructionsChange(event.target.value)}
            rows={1}
          />
          <input
            type="text"
            className={styles.customInstructionsInput}
            placeholder={LABELS.excludedFilePatternsPlaceholder}
            value={excludedFilePatterns}
            onChange={(event) => onExcludedFilePatternsChange(event.target.value)}
          />
        </div>
        {summary && effectiveWorktreeStatus && (
          <section className={styles.branchContextCard}>
            <div className={styles.branchContextHeader}>
              <div className={styles.branchContextSummary}>
                <span className={styles.branchContextTitle}>{LABELS.branchContextHeading}</span>
                <span
                  className={[
                    styles.branchContextBadge,
                    effectiveWorktreeStatus.state === 'ready'
                      ? styles.branchContextReady
                      : effectiveWorktreeStatus.state === 'refreshing'
                        ? styles.branchContextRefreshing
                        : effectiveWorktreeStatus.state === 'blocked'
                          ? styles.branchContextBlocked
                          : styles.branchContextUnavailable
                  ].join(' ')}
                >
                  {branchContextStateLabel(effectiveWorktreeStatus.state)}
                </span>
                {effectiveWorktreeStatus.updatedAt && (
                  <span className={styles.branchContextUpdatedInline}>
                    <span className={styles.branchContextUpdatedLabel}>{LABELS.branchContextUpdated}</span>
                    <span>{formatBranchContextDate(effectiveWorktreeStatus.updatedAt)}</span>
                  </span>
                )}
              </div>
              <div className={styles.branchContextActions}>
                <button
                  className="btn"
                  onClick={() => void handlePreloadBranchContext()}
                  disabled={effectiveWorktreeStatus.state === 'refreshing' || isBranchContextBlocked}
                  title={isBranchContextBlocked ? LABELS.branchContextConfigureActionDisabled : worktreeActionLabel}
                >
                  <i
                    className={`fa-solid ${effectiveWorktreeStatus.state === 'refreshing' ? 'fa-spinner fa-spin' : 'fa-code-branch'}`}
                    aria-hidden="true"
                  /> {worktreeActionLabel}
                </button>
                {isBranchContextBlocked && (
                  <button
                    className="btn"
                    onClick={() => openSettings('preferences')}
                    title={LABELS.branchContextOpenSettings}
                  >
                    <i className="fa-solid fa-gear" aria-hidden="true" /> {LABELS.branchContextOpenSettings}
                  </button>
                )}
              </div>
            </div>
            <div className={styles.branchContextMessage}>{renderBranchContextMessage(effectiveWorktreeStatus, styles)}</div>
            {(effectiveWorktreeStatus.sourceBranch
              || effectiveWorktreeStatus.targetCommitId
              || effectiveWorktreeStatus.sourceCommitId
              || effectiveWorktreeStatus.workingDirectory
              || effectiveWorktreeStatus.mirrorPath) && (
              <div className={styles.branchContextDetails}>
                {effectiveWorktreeStatus.targetCommitId && (
                  <div className={`${styles.branchContextDetail} ${styles.branchContextDetailHash}`}>
                    <span className={styles.branchContextMetaLabel}>{LABELS.branchContextBaseCommit}</span>
                    <div className={styles.branchContextHashRow}>
                      <code className={styles.branchContextMetaHash} title={effectiveWorktreeStatus.targetCommitId}>
                        {effectiveWorktreeStatus.targetCommitId}
                      </code>
                      <CopyButton
                        text={effectiveWorktreeStatus.targetCommitId}
                        title={`Copy ${LABELS.branchContextBaseCommit.toLowerCase()} hash`}
                        className={`btn ${styles.branchContextCopyButton}`}
                      />
                    </div>
                  </div>
                )}
                {effectiveWorktreeStatus.sourceCommitId && (
                  <div className={`${styles.branchContextDetail} ${styles.branchContextDetailHash}`}>
                    <span className={styles.branchContextMetaLabel}>{LABELS.branchContextHeadCommit}</span>
                    <div className={styles.branchContextHashRow}>
                      <code className={styles.branchContextMetaHash} title={effectiveWorktreeStatus.sourceCommitId}>
                        {effectiveWorktreeStatus.sourceCommitId}
                      </code>
                      <CopyButton
                        text={effectiveWorktreeStatus.sourceCommitId}
                        title={`Copy ${LABELS.branchContextHeadCommit.toLowerCase()} hash`}
                        className={`btn ${styles.branchContextCopyButton}`}
                      />
                    </div>
                  </div>
                )}
                {effectiveWorktreeStatus.workingDirectory && (
                  <div className={`${styles.branchContextDetail} ${styles.branchContextDetailWide}`}>
                    <span className={styles.branchContextMetaLabel}>{LABELS.branchContextWorktreePath}</span>
                    <code className={styles.branchContextMetaHash} title={effectiveWorktreeStatus.workingDirectory}>
                      {effectiveWorktreeStatus.workingDirectory}
                    </code>
                  </div>
                )}
                {effectiveWorktreeStatus.mirrorPath && (
                  <div className={`${styles.branchContextDetail} ${styles.branchContextDetailWide}`}>
                    <span className={styles.branchContextMetaLabel}>{LABELS.branchContextMirrorPath}</span>
                    <code className={styles.branchContextMetaHash} title={effectiveWorktreeStatus.mirrorPath}>
                      {effectiveWorktreeStatus.mirrorPath}
                    </code>
                  </div>
                )}
              </div>
            )}
            {effectiveWorktreeStatus.errorMessage && (
              <div className={styles.branchContextError}>{effectiveWorktreeStatus.errorMessage}</div>
            )}
          </section>
        )}
      </div>

      {reviewRuns.length === 0 ? (
        <div className="empty">{LABELS.emptyNoRuns}</div>
      ) : selectedRunId === 'all' ? (
        visibleRuns.length === 0 ? (
          <div className="empty">{LABELS.emptyNoMatchFilter}</div>
        ) : (
          <div className={styles.reviewRunsAll}>
            {visibleRuns.map((run) => (
              <details key={run.id} className={styles.reviewRunSection} open={!collapsedRunIds.has(run.id)}>
                <summary
                  className={styles.reviewRunSectionSummary}
                  onClick={(e) => { e.preventDefault(); onToggleRunCollapsed(run.id); }}
                >
                  <RunHeader
                    run={run}
                    result={run.result}
                    storedSkillNamesByMarker={storedSkillNamesByMarker}
                    onOpenFollowUp={onOpenFollowUp}
                    onOpenPrompt={() => openPromptPreview(run)}
                    onMarkRead={getMarkReadHandler(run, run.filteredComments)}
                    onMarkUnread={getMarkUnreadHandler(run, run.filteredComments)}
                    isCollapsible
                  />
                </summary>
                <div className={styles.reviewRunSectionBody}>
                  <RunResult
                    run={run}
                    result={run.result}
                    storedSkillNamesByMarker={storedSkillNamesByMarker}
                    comments={run.filteredComments}
                    selectedSeverityFilter={selectedSeverityFilter}
                    onSeverityFilterChange={setSelectedSeverityFilter}
                    onNavigateToLine={onNavigateToLine}
                    isCommentRead={isCommentRead}
                    onToggleCommentRead={onToggleCommentRead}
                  />
                </div>
              </details>
            ))}
          </div>
        )
      ) : selectedRun ? (
        <details className={styles.reviewRunSection} open={!collapsedRunIds.has(selectedRun.id)}>
          <summary
            className={styles.reviewRunSectionSummary}
            onClick={(e) => { e.preventDefault(); onToggleRunCollapsed(selectedRun.id); }}
          >
            <RunHeader
              run={selectedRun}
              result={selectedRun.result}
              storedSkillNamesByMarker={storedSkillNamesByMarker}
              onOpenFollowUp={onOpenFollowUp}
              onOpenPrompt={() => openPromptPreview(selectedRun)}
              onMarkRead={getMarkReadHandler(selectedRun)}
              onMarkUnread={getMarkUnreadHandler(selectedRun)}
              isCollapsible
            />
          </summary>
          <div className={styles.reviewRunSectionBody}>
            <RunResult
              run={selectedRun}
              result={selectedRun.result}
              storedSkillNamesByMarker={storedSkillNamesByMarker}
              comments={comments}
              selectedSeverityFilter={selectedSeverityFilter}
              onSeverityFilterChange={setSelectedSeverityFilter}
              onNavigateToLine={onNavigateToLine}
              isCommentRead={isCommentRead}
              onToggleCommentRead={onToggleCommentRead}
            />
          </div>
        </details>
      ) : (
        <div className="empty">{LABELS.emptySelectRun}</div>
      )}

      <PromptPreviewModal data={promptPreview} onClose={() => setPromptPreview(null)} />

      {/* ── Review options modal ── */}
      {reviewOptionsOpen && (
        <ReviewOptionsModal
          modelName={modelName}
          modelOptions={modelOptions}
          isModelCatalogReady={isModelCatalogReady}
          modelCatalogUnavailableMessage={LABELS.modelCatalogUnavailable}
          promptLibrary={promptLibrary}
          selectedPromptId={selectedPromptId}
          currentProjectKeys={currentProjectKeys}
          currentOrganizationId={currentOrganizationId}
          onConfirm={handleReviewOptionsConfirm}
          onCancel={() => setReviewOptionsOpen(false)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm?.all ? LABELS.confirmDeleteAllTitle : LABELS.confirmDeleteSingleTitle}
        message={deleteConfirm?.all
          ? LABELS.confirmDeleteAllMessage
          : LABELS.confirmDeleteSingleMessage}
        confirmLabel={LABELS.confirmDelete}
        onConfirm={() => {
          if (deleteConfirm !== null) {
            onDeleteReviewRuns(deleteConfirm.jobId);
          }
          setDeleteConfirm(null);
        }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

function buildUnavailableStatus(summary: PullRequestSummary, statusMessage: string): ReviewWorktreeStatus {
  return {
    pullRequestId: summary.id,
    repository: summary.repository,
    state: 'unavailable',
    statusMessage,
    blockingReason: null,
    errorMessage: null,
    updatedAt: null
  };
}

function buildBlockedStatus(summary: PullRequestSummary, statusMessage: string): ReviewWorktreeStatus {
  return {
    pullRequestId: summary.id,
    repository: summary.repository,
    state: 'blocked',
    statusMessage,
    blockingReason: 'missing-root-folder',
    errorMessage: null,
    updatedAt: null
  };
}

function buildInitialWorktreeStatus(summary: PullRequestSummary, reviewWorktreeRootFolder: string): ReviewWorktreeStatus {
  return reviewWorktreeRootFolder
    ? buildUnavailableStatus(summary, LABELS.branchContextInitial)
    : buildBlockedStatus(summary, LABELS.branchContextRootRequired);
}

function branchContextStateLabel(state: ReviewWorktreeStatus['state']): string {
  if (state === 'ready') {
    return LABELS.branchContextReady;
  }
  if (state === 'refreshing') {
    return LABELS.branchContextRefreshing;
  }
  if (state === 'blocked') {
    return LABELS.branchContextBlocked;
  }
  return LABELS.branchContextUnavailable;
}

function stripHeadsPrefix(refName?: string | null): string {
  return (refName ?? '').replace(/^refs\/heads\//, '');
}

function formatBranchContextDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function renderBranchContextMessage(
  status: ReviewWorktreeStatus,
  reviewTabStyles: Record<string, string>
): ReactNode {
  if (status.state === 'ready' && status.sourceBranch && status.targetBranch) {
    return (
      <>
        <span>Branch context ready for </span>
        <span className={reviewTabStyles.branchContextBranchBadge}>{stripHeadsPrefix(status.sourceBranch)}</span>
        <span> against </span>
        <span className={reviewTabStyles.branchContextBranchBadge}>{stripHeadsPrefix(status.targetBranch)}</span>
        <span>.</span>
      </>
    );
  }

  return status.statusMessage;
}
