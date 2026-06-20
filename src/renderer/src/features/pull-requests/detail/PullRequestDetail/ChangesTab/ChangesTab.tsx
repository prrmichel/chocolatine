import { useRef, useState, useMemo, useEffect, useCallback, useDeferredValue } from 'react';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { CopilotReviewResult, PullRequestFileDiff, PullRequestSummary, PullRequestThread, ReviewJob } from '@shared/types/models';
import { copyToClipboard } from '@renderer/utils/clipboard';
import { buildAdoCommentDraft, normalizePath, arePathsEquivalent, buildFileTree, filterTree } from '../PullRequestDetail.helpers';
import { api } from '@renderer/services/api';
import { useResizeDrag } from '@renderer/hooks/useResizeDrag';
import FileTree from './FileTree/FileTree';
import DiffViewer, { AdoThreadsSection } from './DiffViewer/DiffViewer';
import FilterToolbar from './FilterToolbar/FilterToolbar';
import FileLevelComments from './FileLevelComments/FileLevelComments';
import AdoCommentComposerModal from './AdoCommentComposerModal';
import type { ReviewCommentEntry } from './ChangesTab.types';
import FollowUpTab from '../FollowUpTab/FollowUpTab';
import SelectionAskButton from './SelectionAskButton/SelectionAskButton';
import { LABELS } from './ChangesTab.messages';
import styles from './ChangesTab.module.css';


interface ChangesTabProps {
  diffs: PullRequestFileDiff[];
  prThreads: PullRequestThread[];
  reviewRuns: { id: string; runNumber: number; modelName?: string | null; result: CopilotReviewResult | null }[];
  defaultDiffViewMode?: 'inline' | 'side';
  selectedDiffPath: string | null;
  diffsLoading: boolean;
  allFileComments: Map<number, ReviewCommentEntry[]>;
  onSelectDiff: (path: string) => void;
  onNavigateToReviews: () => void;
  isCommentRead: (commentKey: string) => boolean;
  onToggleCommentRead: (commentKey: string) => void;
  isCommentFavorite: (commentKey: string) => boolean;
  onToggleCommentFavorite: (commentKey: string) => void;
  onOpenFollowUpFromComment?: (runId: string) => void;
  onMarkCommentsRead: (keys: string[]) => void;
  onMarkCommentsUnread: (keys: string[]) => void;
  isThreadRead: (threadId: number) => boolean;
  onToggleThreadRead: (threadId: number) => void;
  onToggleThreadResolved: (thread: PullRequestThread) => Promise<void>;
  isThreadStatusUpdating: (threadId: number) => boolean;
  pullRequest: PullRequestSummary | null;
  pullRequestRepositoryId: string | null;
  reviewJobs: ReviewJob[];
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  followUpPanelOpen: boolean;
  followUpPanelHeight: number;
  onFollowUpPanelOpenChange: (open: boolean) => void;
  onFollowUpPanelHeightChange: (height: number) => void;
  onRefreshThreads: () => Promise<void>;
  getCommentSentAt: (commentKey: string) => string | null;
  onMarkCommentSent: (commentKey: string, sentAt: string) => void | Promise<void>;
}

export default function ChangesTab({
  diffs,
  prThreads,
  reviewRuns,
  defaultDiffViewMode = 'inline',
  selectedDiffPath,
  diffsLoading,
  allFileComments,
  onSelectDiff,
  onNavigateToReviews,
  isCommentRead,
  onToggleCommentRead,
  isCommentFavorite,
  onToggleCommentFavorite,
  onOpenFollowUpFromComment,
  onMarkCommentsRead,
  onMarkCommentsUnread,
  isThreadRead,
  onToggleThreadRead,
  onToggleThreadResolved,
  isThreadStatusUpdating,
  pullRequest,
  pullRequestRepositoryId,
  reviewJobs,
  modelOptions,
  followUpPanelOpen,
  followUpPanelHeight,
  onFollowUpPanelOpenChange,
  onFollowUpPanelHeightChange,
  onRefreshThreads,
  getCommentSentAt,
  onMarkCommentSent
}: ChangesTabProps) {
  const [changesListWidth, setChangesListWidth] = useState(260);
  const [isFileTreeCollapsed, setIsFileTreeCollapsed] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<'inline' | 'side'>(defaultDiffViewMode);
  const [fileFilterText, setFileFilterText] = useState('');
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  const [hideAllRuns, setHideAllRuns] = useState(false);
  const [showUserComments, setShowUserComments] = useState(true);
  const [showReadComments, setShowReadComments] = useState(true);
  const [showUnreadComments, setShowUnreadComments] = useState(true);
  const [followUpPendingContextId, setFollowUpPendingContextId] = useState<string | null>(null);
  const [askPendingJobId, setAskPendingJobId] = useState<string | null>(null);
  const [askPendingMessage, setAskPendingMessage] = useState('');
  const [adoComposerEntry, setAdoComposerEntry] = useState<ReviewCommentEntry | null>(null);
  const [adoComposerDraft, setAdoComposerDraft] = useState('');
  const [adoComposerError, setAdoComposerError] = useState<string | null>(null);
  const [adoComposerSending, setAdoComposerSending] = useState(false);
  const [fullDiffTexts, setFullDiffTexts] = useState<Map<string, string>>(new Map());
  const [isLoadingFullDiff, setIsLoadingFullDiff] = useState(false);
  const deferredFileFilterText = useDeferredValue(fileFilterText);
  const changesRef = useRef<HTMLDivElement | null>(null);
  const changesBodyRef = useRef<HTMLDivElement | null>(null);
  const followUpBodyRef = useRef<HTMLDivElement | null>(null);
  const diffViewBodyRef = useRef<HTMLDivElement | null>(null);
  const hasInitializedFollowUpHeightRef = useRef(false);

  const handleOpenFollowUp = useCallback(async (runId: string) => {
    if (onOpenFollowUpFromComment) {
      onOpenFollowUpFromComment(runId);
      return;
    }
    const job = reviewJobs.find((j) => j.id === runId);
    if (!job) return;
    try {
      const ctx = await api.createFollowUpContext(job);
      setFollowUpPendingContextId(ctx.id);
      onFollowUpPanelOpenChange(true);
    } catch { /* noop */ }
  }, [onOpenFollowUpFromComment, reviewJobs, onFollowUpPanelOpenChange]);

  useEffect(() => {
    if (!diffsLoading && diffs.length > 0) {
      setDiffViewMode(defaultDiffViewMode);
    }
  }, [diffsLoading, diffs.length, defaultDiffViewMode]);

  // Initialize follow-up panel height at load/open to 50% of current changes area.
  useEffect(() => {
    if (!followUpPanelOpen) {
      hasInitializedFollowUpHeightRef.current = false;
      return;
    }
    if (hasInitializedFollowUpHeightRef.current || !changesBodyRef.current) {
      return;
    }

    const body = changesBodyRef.current;
    const initializeHeight = () => {
      const bodyHeight = body.clientHeight;
      if (bodyHeight <= 0) return;
      const halfHeight = Math.max(Math.round(bodyHeight / 2), 160);
      onFollowUpPanelHeightChange(halfHeight);
      hasInitializedFollowUpHeightRef.current = true;
    };

    initializeHeight();
    if (hasInitializedFollowUpHeightRef.current) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (hasInitializedFollowUpHeightRef.current) {
        observer.disconnect();
        return;
      }
      initializeHeight();
      if (hasInitializedFollowUpHeightRef.current) {
        observer.disconnect();
      }
    });
    observer.observe(body);
    return () => observer.disconnect();
  }, [followUpPanelOpen, onFollowUpPanelHeightChange, diffsLoading]);

  useEffect(() => {
    if (changesRef.current) {
      changesRef.current.style.setProperty('--changes-list-width', `${changesListWidth}px`);
    }
  }, [changesListWidth]);

  useEffect(() => {
    if (changesBodyRef.current) {
      changesBodyRef.current.style.setProperty('--follow-up-panel-height', `${followUpPanelHeight}px`);
    }
  }, [followUpPanelHeight]);

  const selectedDiff = useMemo(
    () => diffs.find((diff) => diff.path === selectedDiffPath) ?? diffs[0],
    [diffs, selectedDiffPath]
  );

  const fileTree = useMemo(() => buildFileTree(diffs), [diffs]);
  const filteredTree = useMemo(() => filterTree(fileTree, deferredFileFilterText), [fileTree, deferredFileFilterText]);

  const runFilterOptions = useMemo(
    () => reviewRuns.map((run) => ({
      id: run.id,
      label: `Run ${run.runNumber} · ${getModelDisplayName(run.modelName)}`,
      commentCount: run.result !== null ? (run.result?.comments?.length ?? 0) : undefined
    })),
    [reviewRuns]
  );

  const runNumbers = useMemo(
    () => new Map(reviewRuns.map((run) => [run.id, run.runNumber])),
    [reviewRuns]
  );

  const selectedRunIdSet = useMemo(() => new Set(selectedRunIds), [selectedRunIds]);
  const allRunsSelected = !hideAllRuns && selectedRunIds.length === 0;

  const visibleCommentKeys = useMemo(() => {
    if (hideAllRuns) return [];
    const keys: string[] = [];
    for (const entries of allFileComments.values()) {
      for (const entry of entries) {
        if (allRunsSelected || selectedRunIdSet.has(entry.runId)) {
          keys.push(entry.commentKey);
        }
      }
    }
    return keys;
  }, [allFileComments, allRunsSelected, selectedRunIdSet, hideAllRuns]);

  const filteredLineComments = useMemo(() => {
    if (hideAllRuns) return new Map<number, ReviewCommentEntry[]>();
    let source = allFileComments;

    // Filter by selected runs
    if (!allRunsSelected) {
      const map = new Map<number, ReviewCommentEntry[]>();
      for (const [line, entries] of source.entries()) {
        const filtered = entries.filter((entry) => selectedRunIdSet.has(entry.runId));
        if (filtered.length > 0) {
          map.set(line, filtered);
        }
      }
      source = map;
    }

    // Filter by read/unread visibility
    if (!showReadComments || !showUnreadComments) {
      const map = new Map<number, ReviewCommentEntry[]>();
      for (const [line, entries] of source.entries()) {
        const filtered = entries.filter((entry) => {
          const read = isCommentRead(entry.commentKey);
          if (read && !showReadComments) return false;
          if (!read && !showUnreadComments) return false;
          return true;
        });
        if (filtered.length > 0) {
          map.set(line, filtered);
        }
      }
      source = map;
    }

    // Include all entries (fallback entries are now keyed by their actual lineNew in PullRequestDetail)
    const lineMap = new Map<number, ReviewCommentEntry[]>();
    for (const [line, entries] of source.entries()) {
      if (entries.length > 0) lineMap.set(line, entries);
    }
    return lineMap;
  }, [allFileComments, allRunsSelected, selectedRunIdSet, showReadComments, showUnreadComments, isCommentRead, hideAllRuns]);

  /** Lines that have comments but are not currently in the diff (fallback placements with evidence). */
  const topLevelComments = useMemo(() => {
    if (hideAllRuns) return [];
    const result: ReviewCommentEntry[] = [];
    for (const entries of allFileComments.values()) {
      for (const entry of entries) {
        if (!entry.isFallbackPlacement) continue;
        // Skip entries that will be shown inline via augmented diff (have lineNew + evidence)
        if (entry.comment.lineNew && entry.comment.lineNew > 0 && entry.comment.evidence) continue;
        if (!allRunsSelected && !selectedRunIdSet.has(entry.runId)) continue;
        const read = isCommentRead(entry.commentKey);
        if (read && !showReadComments) continue;
        if (!read && !showUnreadComments) continue;
        result.push(entry);
      }
    }
    return result;
  }, [allFileComments, allRunsSelected, selectedRunIdSet, showReadComments, showUnreadComments, isCommentRead, hideAllRuns]);

  /**
   * Augmented diff text: the original diff plus synthetic context hunks for any comment lines
   * not included in the diff. Uses `comment.evidence` as the line content.
   */
  const augmentedDiffText = useMemo(() => {
    const base = selectedDiff?.diffText ?? '';
    if (!base || hideAllRuns) return base;

    // Collect unique (lineNum → evidence) from fallback comments that have both lineNew and evidence
    const orphanedLines = new Map<number, string>();
    for (const entries of allFileComments.values()) {
      for (const entry of entries) {
        if (!entry.isFallbackPlacement) continue;
        if (!allRunsSelected && !selectedRunIdSet.has(entry.runId)) continue;
        const read = isCommentRead(entry.commentKey);
        if (read && !showReadComments) continue;
        if (!read && !showUnreadComments) continue;
        const lineNum = entry.comment.lineNew;
        if (!lineNum || lineNum <= 0 || !entry.comment.evidence) continue;
        if (!orphanedLines.has(lineNum)) {
          orphanedLines.set(lineNum, entry.comment.evidence);
        }
      }
    }
    if (orphanedLines.size === 0) return base;

    // Build a synthetic hunk for each orphaned line (minimal: just the one line as context)
    const syntheticHunks = [...orphanedLines.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([lineNum, evidence]) => {
        const content = ` ${evidence.trimEnd()}`; // space prefix = context line
        return `@@ -${lineNum},1 +${lineNum},1 @@\n${content}`;
      });

    // Insert before the closing ``` marker if present, otherwise append
    const closingMarker = '\n```';
    const lastBacktick = base.trimEnd().lastIndexOf(closingMarker);
    if (lastBacktick >= 0) {
      return base.slice(0, lastBacktick) + '\n\n' + syntheticHunks.join('\n\n') + closingMarker;
    }
    return base + '\n\n' + syntheticHunks.join('\n\n');
  }, [selectedDiff?.diffText, allFileComments, allRunsSelected, selectedRunIdSet, showReadComments, showUnreadComments, isCommentRead, hideAllRuns]);

  const filteredPrThreads = useMemo(() => {
    return showUserComments ? prThreads : [];
  }, [prThreads, showUserComments]);

  const allFileThreads = useMemo(() => {
    const map = new Map<number, PullRequestThread[]>();
    if (!selectedDiff) return map;
    for (const thread of filteredPrThreads) {
      if (!thread.filePath || thread.line === undefined || thread.line === null) continue;
      const line = Number(thread.line);
      if (!Number.isFinite(line) || line <= 0) continue;
      if (!arePathsEquivalent(thread.filePath, selectedDiff.path)) continue;
      const existing = map.get(line) ?? [];
      existing.push(thread);
      map.set(line, existing);
    }
    return map;
  }, [filteredPrThreads, selectedDiff]);

  const fileLevelThreads = useMemo(() => {
    if (!selectedDiff) return [];
    const inlineIds = new Set<number>();
    for (const threads of allFileThreads.values()) {
      for (const t of threads) inlineIds.add(t.id);
    }
    return filteredPrThreads.filter((t) => {
      if (!t.filePath) return false;
      if (!arePathsEquivalent(t.filePath, selectedDiff.path)) return false;
      return !inlineIds.has(t.id);
    });
  }, [filteredPrThreads, selectedDiff, allFileThreads]);

  const generalThreads = useMemo(
    () => filteredPrThreads.filter((t) => !t.filePath),
    [filteredPrThreads]
  );

  const fileCommentCounts = useMemo(() => {
    const counts = new Map<string, number>();

    // Build a normalized-path → canonical diff path lookup (O(diffs) once)
    const normalizedToDiffPath = new Map<string, string>();
    for (const diff of diffs) {
      normalizedToDiffPath.set(normalizePath(diff.path), diff.path);
    }

    const resolvePath = (filePath: string): string => {
      const n = normalizePath(filePath);
      const exact = normalizedToDiffPath.get(n);
      if (exact) return normalizePath(exact);
      // Fallback: suffix matching (e.g. "a/src/file.ts" vs "src/file.ts")
      for (const [normalizedDiff, diffPath] of normalizedToDiffPath) {
        if (normalizedDiff.endsWith(`/${n}`) || n.endsWith(`/${normalizedDiff}`)) {
          return normalizePath(diffPath);
        }
      }
      return n;
    };

    if (!hideAllRuns) {
      for (const run of reviewRuns) {
        if (!allRunsSelected && !selectedRunIdSet.has(run.id)) {
          continue;
        }
        for (const comment of run.result?.comments ?? []) {
          if (!comment.file) {
            continue;
          }
          const key = resolvePath(comment.file);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        }
      }
    }

    for (const thread of filteredPrThreads) {
      if (!thread.filePath) {
        continue;
      }
      const key = resolvePath(thread.filePath);
      counts.set(key, (counts.get(key) ?? 0) + thread.comments.length);
    }

    return counts;
  }, [reviewRuns, allRunsSelected, selectedRunIdSet, hideAllRuns, filteredPrThreads, diffs]);

  const toggleRunSelection = (runId: string) => {
    setHideAllRuns(false);
    setSelectedRunIds((prev) => {
      if (prev.length === 0) {
        return [runId];
      }
      if (prev.includes(runId)) {
        const next = prev.filter((id) => id !== runId);
        return next;
      }
      return [...prev, runId];
    });
  };

  const handleAskMe = useCallback((selectedText: string) => {
    const sortedJobs = [...reviewJobs].sort((a, b) => {
      const aTime = new Date(a.completedAt ?? a.startedAt ?? a.queuedAt).getTime();
      const bTime = new Date(b.completedAt ?? b.startedAt ?? b.queuedAt).getTime();
      return bTime - aTime;
    });
    const lastJob = sortedJobs[0];
    if (!lastJob) return;
    const file = selectedDiff?.path ?? '';
    const filePrefix = file ? `File: \`${file}\`\n\n` : '';
    const codeBlock = selectedText ? `\`\`\`\n${selectedText}\n\`\`\`\n\n` : '';
    setAskPendingJobId(lastJob.id);
    setAskPendingMessage(`${filePrefix}${codeBlock}`);
    onFollowUpPanelOpenChange(true);
  }, [reviewJobs, selectedDiff?.path, onFollowUpPanelOpenChange]);

  const handleAskComment = useCallback((commentText: string) => {
    const sortedJobs = [...reviewJobs].sort((a, b) => {
      const aTime = new Date(a.completedAt ?? a.startedAt ?? a.queuedAt).getTime();
      const bTime = new Date(b.completedAt ?? b.startedAt ?? b.queuedAt).getTime();
      return bTime - aTime;
    });
    const lastJob = sortedJobs[0];
    if (!lastJob) return;
    const file = selectedDiff?.path ?? '';
    const filePrefix = file ? `File: \`${file}\`\n\n` : '';
    const quotedComment = commentText ? `> ${commentText.replace(/\n/g, '\n> ')}\n\n` : '';
    setAskPendingJobId(lastJob.id);
    setAskPendingMessage(`${filePrefix}${quotedComment}`);
    onFollowUpPanelOpenChange(true);
  }, [reviewJobs, selectedDiff?.path, onFollowUpPanelOpenChange]);

  const handleOpenAdoComposer = useCallback((entry: ReviewCommentEntry) => {
    setAdoComposerEntry(entry);
    setAdoComposerDraft(buildAdoCommentDraft(entry.comment, entry.runNumber, selectedDiff?.path));
    setAdoComposerError(null);
  }, [selectedDiff?.path]);

  const handleCloseAdoComposer = useCallback(() => {
    if (adoComposerSending) {
      return;
    }
    setAdoComposerEntry(null);
    setAdoComposerDraft('');
    setAdoComposerError(null);
  }, [adoComposerSending]);

  const handleSendAdoComment = useCallback(async () => {
    if (!adoComposerEntry || !pullRequest || !pullRequestRepositoryId) {
      setAdoComposerError('The pull request details are still loading. Wait a moment and try again.');
      return;
    }

    setAdoComposerSending(true);
    setAdoComposerError(null);
    try {
      const result = await api.createPullRequestThread({
        repositoryId: pullRequestRepositoryId,
        pullRequestId: pullRequest.id,
        content: adoComposerDraft,
        filePath: adoComposerEntry.comment.file ?? selectedDiff?.path ?? null,
        line: adoComposerEntry.comment.lineNew ?? null
      });
      await onMarkCommentSent(adoComposerEntry.commentKey, result.publishedDate);
      setAdoComposerEntry(null);
      setAdoComposerDraft('');
      setAdoComposerError(null);
      void onRefreshThreads();
    } catch (error) {
      setAdoComposerError(error instanceof Error ? error.message : 'Unable to send the comment to Azure DevOps.');
    } finally {
      setAdoComposerSending(false);
    }
  }, [
    adoComposerDraft,
    adoComposerEntry,
    onMarkCommentSent,
    onRefreshThreads,
    pullRequest,
    pullRequestRepositoryId,
    selectedDiff?.path
  ]);

  const startResizeChanges = useResizeDrag({
    direction: 'horizontal',
    startSize: changesListWidth,
    minSize: 180,
    maxSize: changesRef.current ? Math.max(changesRef.current.clientWidth - 240, 180) : 600,
    onResize: setChangesListWidth
  });

  const startResizeFollowUp = useResizeDrag({
    direction: 'vertical',
    startSize: followUpPanelHeight,
    minSize: 160,
    maxSize: changesBodyRef.current
      ? Math.max(changesBodyRef.current.clientHeight - 120, 160)
      : 700,
    onResize: onFollowUpPanelHeightChange
  });

  return (
    <div className={styles.changesTab}>
      <FilterToolbar
        runFilterOptions={runFilterOptions}
        allRunsSelected={allRunsSelected}
        selectedRunIdSet={selectedRunIdSet}
        hideAllRuns={hideAllRuns}
        showUserComments={showUserComments}
        showReadComments={showReadComments}
        showUnreadComments={showUnreadComments}
        visibleCommentKeyCount={visibleCommentKeys.length}
        onSelectAllRuns={() => { setHideAllRuns(false); setSelectedRunIds([]); }}
        onToggleRunSelection={toggleRunSelection}
        onHideAllRuns={() => { setHideAllRuns(true); setSelectedRunIds([]); }}
        onToggleUserComments={() => setShowUserComments((prev) => !prev)}
        onToggleReadComments={() => setShowReadComments((prev) => !prev)}
        onToggleUnreadComments={() => setShowUnreadComments((prev) => !prev)}
        onMarkCommentsRead={() => onMarkCommentsRead(visibleCommentKeys)}
        onMarkCommentsUnread={() => onMarkCommentsUnread(visibleCommentKeys)}
      />
      {diffsLoading ? (
        <div className="loading-block">
          <div className="loading-inline">{LABELS.loadingChanges}</div>
          <div className="loading-bar" />
        </div>
      ) : diffs.length === 0 ? (
        <div className="empty">{LABELS.noChanges}</div>
      ) : (
        <div className={styles.changesBody} ref={changesBodyRef}>
          <div className={styles.changes} ref={changesRef}>
            {!isFileTreeCollapsed && (
              <div className={styles.changesList}>
                <div className={styles.changesListFilter}>
                  <input
                    className="input"
                    type="text"
                    placeholder={LABELS.filterFiles}
                    value={fileFilterText}
                    onChange={(event) => setFileFilterText(event.target.value)}
                  />
                  <button
                    type="button"
                    className={`${styles.fileTreePinBtn} ${styles.fileTreePinBtnActive}`}
                    onClick={() => setIsFileTreeCollapsed(true)}
                    title={LABELS.unpinFileTree}
                    aria-label={LABELS.unpinFileTree}
                  >
                    <i className="fa-solid fa-thumbtack" aria-hidden="true" />
                  </button>
                </div>
                <div className={styles.changesListTree}>
                  <FileTree
                    nodes={filteredTree}
                    selectedPath={selectedDiff?.path ?? null}
                    onSelectDiff={onSelectDiff}
                    commentCounts={fileCommentCounts}
                  />
                </div>
            </div>
          )}
          {isFileTreeCollapsed && (
            <div className={styles.changesListCollapsed}>
              <button
                type="button"
                className={styles.fileTreePinBtn}
                onClick={() => setIsFileTreeCollapsed(false)}
                title={LABELS.pinFileTree}
                aria-label={LABELS.pinFileTree}
              >
                <i className="fa-solid fa-thumbtack-slash" aria-hidden="true" />
              </button>
            </div>
          )}
          {!isFileTreeCollapsed && <div className={styles.changesSplitter} onMouseDown={startResizeChanges} />}
          <div className={styles.diffView}>
            <div className={styles.diffViewTitle} title={selectedDiff?.path ?? LABELS.noFileSelected}>
              <div className={styles.diffViewTitleMain}>
                <i className="fa-regular fa-file-code" aria-hidden="true" />
                <span>{selectedDiff?.path ?? LABELS.noFileSelected}</span>
                {selectedDiff?.path && (
                  <button
                    type="button"
                    className={styles.diffPathCopyBtn}
                    onClick={() => { void copyToClipboard(selectedDiff.path); }}
                    title={LABELS.copyFilePath}
                    aria-label={LABELS.copyFilePath}
                  >
                    <i className="fa-regular fa-copy" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className={styles.diffViewActions}>
                {selectedDiff?.path && pullRequest && (
                  <button
                    type="button"
                    className={`${styles.viewModeBtn} ${fullDiffTexts.has(selectedDiff.path) ? styles.viewModeBtnActive : ''} ${styles.expandDiffButton}`}
                    onClick={async () => {
                      if (fullDiffTexts.has(selectedDiff.path)) {
                        setFullDiffTexts((prev) => { const next = new Map(prev); next.delete(selectedDiff.path); return next; });
                      } else {
                        setIsLoadingFullDiff(true);
                        try {
                          const text = await api.getFullFileDiff(pullRequest.id, selectedDiff.path);
                          setFullDiffTexts((prev) => new Map(prev).set(selectedDiff.path, text));
                        } catch { /* noop */ } finally {
                          setIsLoadingFullDiff(false);
                        }
                      }
                    }}
                    title={fullDiffTexts.has(selectedDiff.path) ? LABELS.showDiffOnly : LABELS.loadAllLines}
                    aria-label={fullDiffTexts.has(selectedDiff.path) ? LABELS.showDiffOnly : LABELS.loadAllLines}
                    disabled={isLoadingFullDiff}
                  >
                    {isLoadingFullDiff
                      ? <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />
                      : <i className="fa-solid fa-expand" aria-hidden="true" />}
                  </button>
                )}
                <div className={styles.viewModeSwitch} role="group" aria-label="Diff view mode">
                  <button
                    type="button"
                    className={`${styles.viewModeBtn} ${diffViewMode === 'inline' ? styles.viewModeBtnActive : ''}`}
                    onClick={() => setDiffViewMode('inline')}
                    title={LABELS.inlineMode}
                    aria-label={LABELS.inlineMode}
                  >
                    <i className="fa-solid fa-align-left" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`${styles.viewModeBtn} ${diffViewMode === 'side' ? styles.viewModeBtnActive : ''}`}
                    onClick={() => setDiffViewMode('side')}
                    title={LABELS.sideMode}
                    aria-label={LABELS.sideMode}
                  >
                    <i className="fa-solid fa-table-columns" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
            <div className={styles.diffViewBody} ref={diffViewBodyRef}>
              <SelectionAskButton containerRef={diffViewBodyRef} onAsk={handleAskMe} />
              <AdoThreadsSection title={LABELS.prComments} threads={generalThreads} isThreadRead={isThreadRead} onToggleThreadRead={onToggleThreadRead} onToggleThreadResolved={onToggleThreadResolved} isThreadStatusUpdating={isThreadStatusUpdating} showFilePath onAskComment={handleAskComment} />
              <AdoThreadsSection title={LABELS.fileComments} threads={fileLevelThreads} isThreadRead={isThreadRead} onToggleThreadRead={onToggleThreadRead} onToggleThreadResolved={onToggleThreadResolved} isThreadStatusUpdating={isThreadStatusUpdating} showFilePath onAskComment={handleAskComment} />
              <FileLevelComments
                entries={topLevelComments}
                isCommentRead={isCommentRead}
                onToggleCommentRead={onToggleCommentRead}
                onAskComment={handleAskComment}
                onSendToAdo={pullRequest && pullRequestRepositoryId ? handleOpenAdoComposer : undefined}
                getCommentSentAt={getCommentSentAt}
              />
              <DiffViewer
                diffText={fullDiffTexts.get(selectedDiff?.path ?? '') ?? augmentedDiffText}
                filePath={selectedDiff?.path ?? undefined}
                viewMode={diffViewMode}
                lineComments={filteredLineComments}
                onGoToReview={onNavigateToReviews}
                isCommentRead={isCommentRead}
                onToggleCommentRead={onToggleCommentRead}
                isCommentFavorite={isCommentFavorite}
                onToggleCommentFavorite={onToggleCommentFavorite}
                onOpenFollowUp={handleOpenFollowUp}
                onAskComment={handleAskComment}
                onSendToAdo={pullRequest && pullRequestRepositoryId ? handleOpenAdoComposer : undefined}
                getCommentSentAt={getCommentSentAt}
                lineThreads={allFileThreads}
                isThreadRead={isThreadRead}
                onToggleThreadRead={onToggleThreadRead}
                onToggleThreadResolved={onToggleThreadResolved}
                isThreadStatusUpdating={isThreadStatusUpdating}
              />
            </div>
          </div>
          </div>
          {followUpPanelOpen && (
            <>
              <div className={styles.followUpHSplitter} onMouseDown={startResizeFollowUp} />
              <div className={styles.followUpPanel}>
                <div className={styles.followUpPanelBody} ref={followUpBodyRef}>
                  {pullRequest && (
                    <FollowUpTab
                      pullRequest={pullRequest}
                      reviewJobs={reviewJobs}
                      modelOptions={modelOptions}
                      pendingContextId={followUpPendingContextId}
                      onPendingContextHandled={() => setFollowUpPendingContextId(null)}
                      pendingAskJobId={askPendingJobId}
                      pendingAskMessage={askPendingMessage}
                      onPendingAskHandled={() => { setAskPendingJobId(null); setAskPendingMessage(''); }}
                      layout="tabs"
                      runNumbers={runNumbers}
                      onClose={() => onFollowUpPanelOpenChange(false)}
                    />
                  )}
                </div>
              </div>
            </>
          )}
          {!followUpPanelOpen && (
            <div className={styles.followUpPanelCollapsed} onClick={() => onFollowUpPanelOpenChange(true)}>
              <span className={styles.followUpPanelTitle}>
                <i className="fa-solid fa-comments" aria-hidden="true" /> {LABELS.followUp}
              </span>
              <i className="fa-solid fa-chevron-up" aria-hidden="true" />
            </div>
          )}
          <AdoCommentComposerModal
            entry={adoComposerEntry}
            draft={adoComposerDraft}
            sending={adoComposerSending}
            error={adoComposerError}
            onDraftChange={setAdoComposerDraft}
            onCancel={handleCloseAdoComposer}
            onSend={() => { void handleSendAdoComment(); }}
          />
        </div>
      )}
    </div>
  );
}
