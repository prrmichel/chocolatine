import { useCallback, useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { PromptLibrarySettings, PullRequestWorkItem, ReviewJob } from '@shared/types/models';
import { getElapsedSeconds, getDisplayProgress, getProgressLabel } from '@renderer/utils/progress';
import { getTextValue, normalizeWorkItemComment, formatRunDate } from '../PullRequestDetail.helpers';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import PromptPreviewModal, { PromptPreviewData } from '@renderer/features/shared/PromptPreviewModal/PromptPreviewModal';
import ModelSelect from '@renderer/features/shared/ModelSelect/ModelSelect';
import { LABELS } from './WorkItemsTab.messages';
import styles from './WorkItemsTab.module.css';

interface WorkItemsTabProps {
  pullRequestId?: number | string;
  workItems: PullRequestWorkItem[];
  workItemsLoading: boolean;
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  workItemsSummaryModelName: string;
  workItemsSummaryLoading: boolean;
  workItemsSummaryText: string;
  promptLibrary: PromptLibrarySettings | null;
  selectedPromptId: string | null;
  workItemsSummaryPromptExtra: string;
  summaryRuns: ReviewJob[];
  hasSummary: boolean;
  onOpenWorkItem: (id: number) => void;
  onWorkItemsSummaryModelChange: (value: string) => void;
  onSelectedPromptIdChange: (value: string) => void;
  onWorkItemsSummaryPromptExtraChange: (value: string) => void;
  onGenerateWorkItemsSummary: () => void;
  onDeleteSummaryRun: (jobId: string) => Promise<void>;
}

export default function WorkItemsTab({
  pullRequestId,
  workItems,
  workItemsLoading,
  modelOptions,
  workItemsSummaryModelName,
  workItemsSummaryLoading,
  workItemsSummaryText,
  promptLibrary,
  selectedPromptId,
  workItemsSummaryPromptExtra,
  summaryRuns,
  hasSummary,
  onOpenWorkItem,
  onWorkItemsSummaryModelChange,
  onSelectedPromptIdChange,
  onWorkItemsSummaryPromptExtraChange,
  onGenerateWorkItemsSummary,
  onDeleteSummaryRun
}: WorkItemsTabProps) {
  const [copiedRunId, setCopiedRunId] = useState<string | null>(null);
  const copiedResetTimerRef = useRef<number | null>(null);
  const storageKey = pullRequestId != null ? `pr-summary-open-state:${pullRequestId}` : null;

  // Reads the stored per-run open/closed state: { [runId]: true|false }
  // Absence of a key means the run has never been seen → default to open
  const readOpenState = (): Record<string, boolean> => {
    if (!storageKey) return {};
    try {
      const raw = localStorage.getItem(storageKey);
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  };

  const writeOpenState = useCallback((state: Record<string, boolean>) => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  // Mutable ref holding the canonical per-run open state (mirrors localStorage)
  const openStateRef = useRef<Record<string, boolean>>(readOpenState());

  const [promptPreview, setPromptPreview] = useState<PromptPreviewData | null>(null);
  const [deleteConfirmRunId, setDeleteConfirmRunId] = useState<string | null>(null);
  const [isCustomPromptOpen, setIsCustomPromptOpen] = useState(false);
  const hasToggledCustomPromptRef = useRef(false);
  const [openRunIds, setOpenRunIds] = useState<Set<string>>(() => {
    const state = openStateRef.current;
    // For runs already present: respect stored value (default true if never seen)
    return new Set(summaryRuns.map((r) => r.id).filter((id) => state[id] !== false));
  });

  // Handle summaryRuns changes: open truly-new runs, restore known-open runs from async load
  useEffect(() => {
    setOpenRunIds((prev) => {
      const state = openStateRef.current;
      let changed = false;
      const next = new Set(prev);
      for (const run of summaryRuns) {
        if (!(run.id in state)) {
          // Truly new run (never seen): auto-open and persist
          state[run.id] = true;
          next.add(run.id);
          changed = true;
        } else if (state[run.id] === true && !prev.has(run.id)) {
          // Known-open run loaded asynchronously (summaryRuns was [] at mount)
          next.add(run.id);
          changed = true;
        }
        // state[run.id] === false → user collapsed it, leave closed
      }
      if (changed) writeOpenState(state);
      return changed ? next : prev;
    });
  }, [summaryRuns, writeOpenState]);

  useEffect(() => {
    if (!hasToggledCustomPromptRef.current && workItemsSummaryPromptExtra.trim()) {
      setIsCustomPromptOpen(true);
    }
  }, [workItemsSummaryPromptExtra]);

  useEffect(() => {
    return () => {
      if (copiedResetTimerRef.current != null) {
        window.clearTimeout(copiedResetTimerRef.current);
      }
    };
  }, []);

  const copySummaryToClipboard = useCallback(async (run: ReviewJob) => {
    const textToCopy = run.reviewResponse ?? run.errorMessage ?? '';
    if (!textToCopy) return;

    const fallbackCopy = () => {
      const textarea = document.createElement('textarea');
      textarea.value = textToCopy;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        fallbackCopy();
      }
      setCopiedRunId(run.id);
      if (copiedResetTimerRef.current != null) {
        window.clearTimeout(copiedResetTimerRef.current);
      }
      copiedResetTimerRef.current = window.setTimeout(() => setCopiedRunId(null), 1800);
    } catch {
      fallbackCopy();
      setCopiedRunId(run.id);
      if (copiedResetTimerRef.current != null) {
        window.clearTimeout(copiedResetTimerRef.current);
      }
      copiedResetTimerRef.current = window.setTimeout(() => setCopiedRunId(null), 1800);
    }
  }, []);

  const toggleRun = (id: string) => {
    setOpenRunIds((prev) => {
      const next = new Set(prev);
      const willBeOpen = !prev.has(id);
      if (willBeOpen) next.add(id); else next.delete(id);
      // Persist the new state for this run
      const state = openStateRef.current;
      state[id] = willBeOpen;
      writeOpenState(state);
      return next;
    });
  };
  const summaryPrompts = (promptLibrary?.prompts ?? []).filter(
    (prompt) => (prompt.category ?? 'PR Review') === 'Work Item changes summary'
  );
  const hasSummaryPrompt = summaryPrompts.length > 0;

  return (
    <div className={styles.workItemsTab}>
      {workItemsLoading ? (
        <div className="loading-block">
          <div className="loading-inline">Loading work items...</div>
          <div className="loading-bar" />
        </div>
      ) : workItems.length === 0 ? (
        <div className="empty">No work items.</div>
      ) : (
        <div className={styles.workItemCards}>
          {workItems.map((item) => (
            <details key={item.id} className={styles.workItemCard} open>
              <summary className={styles.workItemCardHeader}>
                <button className="link" onClick={() => onOpenWorkItem(item.id)}>#{item.id}</button>
                <strong>{getTextValue(item.title)}</strong>
                <i className={`fa-solid fa-chevron-down ${styles.workItemCardChevron}`} aria-hidden="true" />
              </summary>
              <div className={styles.workItemCardBody}>
                <div className={styles.workItemFields}>
                  <section className={styles.workItemField}>
                    <h4>Title</h4>
                    <div className={styles.workItemFieldContent}>{getTextValue(item.title)}</div>
                  </section>
                  <section className={styles.workItemField}>
                    <h4>Description</h4>
                    <div className={styles.workItemFieldContent}>{getTextValue(item.description)}</div>
                  </section>
                  <section className={styles.workItemField}>
                    <h4>Acceptance criteria</h4>
                    <div className={styles.workItemFieldContent}>{getTextValue(item.acceptanceCriteria)}</div>
                  </section>
                  <section className={styles.workItemField}>
                    <h4>Repro Steps / Newsletter Description</h4>
                    <div className={styles.workItemFieldContent}>{getTextValue(item.reproStepsOrNewsletterDescription)}</div>
                  </section>
                  <section className={styles.workItemField}>
                    <h4>Comments</h4>
                    {item.comments && item.comments.length > 0 ? (
                      <ul className={styles.workItemComments}>
                        {item.comments.map((comment, index) => {
                          const normalized = normalizeWorkItemComment(comment);
                          return (
                            <li key={`${item.id}-${index}`} className={styles.workItemFieldContent}>
                              <span className={styles.workItemCommentLine}>
                                {normalized.author ? <strong>{normalized.author}:</strong> : null}
                                <span>{getTextValue(normalized.text)}</span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <div className={styles.workItemFieldContent}>No comments.</div>
                    )}
                  </section>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}

      <div className={styles.workItemsTabActions}>
        <ModelSelect
          value={workItemsSummaryModelName}
          options={modelOptions}
          onChange={onWorkItemsSummaryModelChange}
          className={`model-select ${styles.workItemsSummaryModel}`}
          keyPrefix="work-items"
        />
        <select
          className={`model-select ${styles.workItemsSummaryPromptSelect}`}
          value={selectedPromptId ?? summaryPrompts[0]?.id ?? ''}
          onChange={(event) => onSelectedPromptIdChange(event.target.value)}
          disabled={summaryPrompts.length === 0}
        >
          {summaryPrompts.length === 0 ? (
            <option value="">{LABELS.noPromptOption}</option>
          ) : (
            summaryPrompts.map((prompt) => (
              <option key={prompt.id} value={prompt.id}>
                {prompt.name}
              </option>
            ))
          )}
        </select>
        <button
          className="btn accent"
          onClick={onGenerateWorkItemsSummary}
          disabled={!hasSummary || workItemsSummaryLoading || !hasSummaryPrompt}
          title={
            !hasSummaryPrompt
              ? LABELS.generateSummaryPromptRequired
              : (workItemsSummaryLoading ? LABELS.generatingSummaryBtn : LABELS.generateSummaryBtn)
          }
          aria-label={workItemsSummaryLoading ? LABELS.generatingSummaryBtn : LABELS.generateSummaryBtn}
        >
          <i className="fa-solid fa-play" aria-hidden="true" />
        </button>
      </div>
      {!hasSummaryPrompt && (
        <div className="muted">{LABELS.noPromptHelp}</div>
      )}

      <details
        className={styles.workItemsSummaryCustomPrompt}
        open={isCustomPromptOpen}
        onToggle={(event) => {
          hasToggledCustomPromptRef.current = true;
          setIsCustomPromptOpen((event.currentTarget as HTMLDetailsElement).open);
        }}
      >
        <summary className={styles.workItemsSummaryCustomPromptSummary}>
          <span>Custom summary instructions</span>
          <i className={`fa-solid fa-chevron-down ${styles.workItemsSummaryCustomPromptChevron}`} aria-hidden="true" />
        </summary>
        <div className={styles.workItemsSummaryCustomPromptBody}>
          <textarea
            value={workItemsSummaryPromptExtra}
            onChange={(event) => onWorkItemsSummaryPromptExtraChange(event.target.value)}
            rows={4}
          />
        </div>
      </details>

      {workItemsSummaryText ? <div className="muted">{workItemsSummaryText}</div> : null}

      <div className={styles.workItemsSummaryHistory}>
        <h4>Summary generations</h4>
        {summaryRuns.length === 0 ? (
          <div className="empty">No summary generation yet.</div>
        ) : (
          <div className={styles.workItemsSummaryList}>
            {summaryRuns.map((run, index) => (
              <details
                key={run.id}
                className={styles.workItemsSummary}
                open={openRunIds.has(run.id)}
              >
                <summary
                  className={styles.workItemsSummaryHeader}
                  onClick={(e) => { e.preventDefault(); toggleRun(run.id); }}
                >
                  <strong>{`Generation ${summaryRuns.length - index}`}</strong>
                  <span className="muted">{formatRunDate(run)}</span>
                  <span className="muted">{getModelDisplayName(run.modelName)}</span>
                  <span className={styles.workItemsSummaryHeaderActions}>
                    <button
                      className="btn"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        void copySummaryToClipboard(run);
                      }}
                      title={copiedRunId === run.id ? 'Summary copied' : 'Copy summary'}
                      aria-label={copiedRunId === run.id ? 'Summary copied' : 'Copy summary'}
                      disabled={!run.reviewResponse && !run.errorMessage}
                    >
                      <i
                        className={copiedRunId === run.id ? 'fa-solid fa-check' : 'fa-regular fa-copy'}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      className="btn"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setPromptPreview({
                          mode: 'simple',
                          title: `Executed prompt · Generation ${summaryRuns.length - index}`,
                          content: run.prompt ?? ''
                        });
                      }}
                      title="View executed prompt"
                      aria-label="View executed prompt"
                    >
                      <i className="fa-solid fa-circle-info" aria-hidden="true" />
                    </button>
                    <button
                      className="btn btn-danger"
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setDeleteConfirmRunId(run.id);
                      }}
                      title="Delete this summary generation"
                      aria-label="Delete this summary generation"
                    >
                      <i className="fa-regular fa-trash-can" aria-hidden="true" />
                    </button>
                    <i className={`fa-solid fa-chevron-down ${styles.workItemsSummaryChevron}`} aria-hidden="true" />
                  </span>
                </summary>
                <div className={styles.workItemsSummaryBody}>
                  {(run.status === 'Queued' || run.status === 'Running') && (
                    <div className={styles.workItemsProgressCard}>
                      <div className={styles.workItemsProgressHeader}>
                        <span>{getProgressLabel(run, getDisplayProgress(run))}</span>
                        <span>{run.status === 'Running' ? `${getElapsedSeconds(run)}s` : ''}</span>
                      </div>
                      <div className={styles.workItemsProgressTrack}>
                        <div
                          className={`${styles.workItemsProgressBar} ${run.status === 'Running' ? styles.workItemsProgressRunning : ''}`}
                          style={{ width: `${run.status === 'Queued' ? 0 : getDisplayProgress(run)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="muted">{run.status}</div>
                  <div className={styles.workItemsSummaryMarkdown}><ReactMarkdown remarkPlugins={[remarkGfm]}>{run.reviewResponse ?? run.errorMessage ?? '(No result yet)'}</ReactMarkdown></div>
                </div>
              </details>
            ))}
          </div>
        )}
      </div>

      <PromptPreviewModal data={promptPreview} onClose={() => setPromptPreview(null)} />

      <ConfirmDialog
        isOpen={deleteConfirmRunId !== null}
        title="Delete summary generation"
        message="This will remove this summary generation from the queue/history and persisted storage."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (!deleteConfirmRunId) return;
          const runId = deleteConfirmRunId;
          setDeleteConfirmRunId(null);
          void onDeleteSummaryRun(runId);
        }}
        onCancel={() => setDeleteConfirmRunId(null)}
      />
    </div>
  );
}
