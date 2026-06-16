import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { getFallbackFreeModelId, getModelDisplayName, normalizeSelectableModelId } from '@shared/constants/modelOptions';
import { copyToClipboard } from '@renderer/utils/clipboard';
import { AskMessage, FollowUpContext, FollowUpContextSummary, PullRequestSummary, ReviewJob } from '@shared/types/models';
import { api } from '@renderer/services/api';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import ModelSelect from '@renderer/features/shared/ModelSelect/ModelSelect';
import { useResizeDrag } from '@renderer/hooks/useResizeDrag';
import styles from './FollowUpTab.module.css';

function formatRunDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffH = diffMs / 3600000;
  if (diffH < 24) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface FollowUpTabProps {
  pullRequest: PullRequestSummary;
  reviewJobs: ReviewJob[];
  modelOptions: { id: string; label: string; disabled?: boolean }[];
  /** When set, the tab should select/open this context (e.g. after "Chat about this run" in ReviewsTab). */
  pendingContextId?: string | null;
  onPendingContextHandled?: () => void;
  /** When set, open or create the context for this job and pre-fill the message input. */
  pendingAskJobId?: string | null;
  pendingAskMessage?: string;
  onPendingAskHandled?: () => void;
  /** 'tabs' shows a horizontal tab bar instead of the sidebar buttons. Default: 'sidebar'. */
  layout?: 'sidebar' | 'tabs';
  /** Maps job id → run number for display labels in tabs layout. */
  runNumbers?: Map<string, number>;
  /** When provided in tabs layout, a close button is added to the tabs bar. */
  onClose?: () => void;
}

export default function FollowUpTab({
  pullRequest,
  reviewJobs,
  modelOptions,
  pendingContextId,
  onPendingContextHandled,
  pendingAskJobId,
  pendingAskMessage,
  onPendingAskHandled,
  layout = 'sidebar',
  runNumbers,
  onClose
}: FollowUpTabProps) {
  const [contextSummaries, setContextSummaries] = useState<FollowUpContextSummary[]>([]);
  const [activeContextId, setActiveContextId] = useState<string | null>(null);
  const [activeContext, setActiveContext] = useState<FollowUpContext | null>(null);
  const [messages, setMessages] = useState<AskMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [modelName, setModelName] = useState(getFallbackFreeModelId());
  const [isStreaming, setIsStreaming] = useState(false);
  const [creatingContextForJobId, setCreatingContextForJobId] = useState<string | null>(null);
  const [deleteContextId, setDeleteContextId] = useState<string | null>(null);
  const [summariesLoaded, setSummariesLoaded] = useState(false);
  const [inputAreaHeight, setInputAreaHeight] = useState(96);
  const [followUpError, setFollowUpError] = useState<string | null>(null);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const autoScrollRef = useRef(true);
  const autoSelectRef = useRef(false);

  const startResizeInput = useResizeDrag({
    direction: 'vertical',
    startSize: inputAreaHeight,
    minSize: 88,
    maxSize: 400,
    onResize: setInputAreaHeight
  });

  useEffect(() => {
    if (panelRef.current) {
      panelRef.current.style.setProperty('--followup-input-height', `${inputAreaHeight}px`);
    }
  }, [inputAreaHeight]);

  // PR scope reset: prevent leaking previous PR context in UI state
  useEffect(() => {
    setActiveContextId(null);
    setActiveContext(null);
    setMessages([]);
    setInputText('');
    setIsStreaming(false);
    setSummariesLoaded(false);
    setFollowUpError(null);
    autoSelectRef.current = false;
  }, [pullRequest?.id, pullRequest?.repository]);

  // Load context summaries whenever the PR changes
  useEffect(() => {
    if (!pullRequest) return;
    setSummariesLoaded(false);
    api.getFollowUpContexts(pullRequest).then((summaries: FollowUpContextSummary[]) => {
      setContextSummaries(summaries);
    }).catch(() => {}).finally(() => setSummariesLoaded(true));
  }, [pullRequest]);

  // Handle pending context from ReviewsTab
  useEffect(() => {
    if (pendingContextId) {
      api.getFollowUpContext(pullRequest, pendingContextId).then((ctx: FollowUpContext | null) => {
        if (ctx) {
          setActiveContextId(pendingContextId);
        }
        // Refresh summaries list
        api.getFollowUpContexts(pullRequest).then((summaries: FollowUpContextSummary[]) => {
          setContextSummaries(summaries);
        }).catch(() => {});
      }).catch(() => {}).finally(() => {
        onPendingContextHandled?.();
      });
    }
  }, [onPendingContextHandled, pendingContextId, pullRequest]);

  // Handle Ask me from inline selection: find or create context for the given job
  useEffect(() => {
    if (!pendingAskJobId || !pullRequest || !summariesLoaded) return;

    const run = async () => {
      const existing = contextSummaries.find((c) => c.reviewJobId === pendingAskJobId);
      if (existing) {
        setActiveContextId(existing.id);
      } else {
        const job = reviewJobs.find((j) => j.id === pendingAskJobId);
        if (job) {
          try {
            setCreatingContextForJobId(pendingAskJobId);
            const ctx = await api.createFollowUpContext(job);
            setContextSummaries((prev) => [...prev, {
              id: ctx.id,
              name: ctx.name,
              pullRequestId: pullRequest.id,
              reviewJobId: ctx.reviewJobId,
              modelName: ctx.modelName,
              messageCount: 0,
              createdAt: ctx.createdAt
            }]);
            setActiveContextId(ctx.id);
          } catch { /* noop */ } finally {
            setCreatingContextForJobId(null);
          }
        }
      }
      if (pendingAskMessage) {
        setInputText(pendingAskMessage);
      }
      onPendingAskHandled?.();
    };

    void run();
  }, [contextSummaries, onPendingAskHandled, pendingAskJobId, pendingAskMessage, pullRequest, reviewJobs, summariesLoaded]);

  // Load full context when active changes
  useEffect(() => {
    if (!activeContextId || !pullRequest) {
      setActiveContext(null);
      setMessages([]);
      return;
    }
    api.getFollowUpContext(pullRequest, activeContextId).then((ctx: FollowUpContext | null) => {
      setActiveContext(ctx);
      setMessages(ctx?.messages ?? []);
      if (ctx?.modelName) {
        setModelName(normalizeSelectableModelId(ctx.modelName));
      }
    }).catch(() => {
      setActiveContext(null);
      setMessages([]);
    });
  }, [activeContextId, pullRequest]);

  // Subscribe to streaming events
  useEffect(() => {
    const unsubDelta = api.onFollowUpDelta((payload: { contextId: string; delta: string; fullText: string }) => {
      if (payload.contextId !== activeContextId) return;
      setMessages((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === 'assistant') {
          copy[copy.length - 1] = { ...last, content: payload.fullText };
        }
        return copy;
      });
      setIsStreaming(true);
    });

    const unsubComplete = api.onFollowUpMessageComplete((payload: { contextId: string }) => {
      if (payload.contextId !== activeContextId) return;
      setIsStreaming(false);
      // Reload full context from main process
      if (pullRequest) {
        api.getFollowUpContext(pullRequest, payload.contextId).then((ctx: FollowUpContext | null) => {
          if (ctx) {
            setActiveContext(ctx);
            setMessages(ctx.messages);
          }
        }).catch(() => {});
        // Refresh summaries (message count changed)
        api.getFollowUpContexts(pullRequest).then((s: FollowUpContextSummary[]) => setContextSummaries(s)).catch(() => {});
      }
    });

    return () => { unsubDelta(); unsubComplete(); };
  }, [activeContextId, pullRequest]);

  // Auto-scroll
  useEffect(() => {
    if (autoScrollRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const threshold = 60;
    autoScrollRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim() || isStreaming || !activeContextId) return;
    if (activeContext?.sessionAvailable === false) return;

    const userText = inputText.trim();
    setInputText('');
    setFollowUpError(null);

    const normalizedModelName = normalizeSelectableModelId(modelName);
    const userMsg: AskMessage = { role: 'user', content: userText, timestamp: new Date().toISOString(), modelName: normalizedModelName };
    const assistantMsg: AskMessage = { role: 'assistant', content: '', timestamp: new Date().toISOString(), modelName: normalizedModelName };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      await api.sendFollowUpMessage(activeContextId, userText, normalizedModelName);
    } catch (error) {
      setMessages((prev) => prev.slice(0, Math.max(0, prev.length - 2)));
      setIsStreaming(false);
      setInputText(userText);
      setFollowUpError(error instanceof Error ? error.message : 'Unable to continue this follow-up conversation.');
    }
  };

  const cancelMessage = async () => {
    if (!activeContextId) return;
    try { await api.cancelFollowUpMessage(activeContextId); } catch { /* noop */ }
    setIsStreaming(false);
  };

  const deleteContext = async (contextId: string) => {
    try {
      await api.deleteFollowUpContext(pullRequest, contextId);
      setFollowUpError(null);
      setContextSummaries((prev) => prev.filter((s) => s.id !== contextId));
      if (activeContextId === contextId) {
        setActiveContextId(null);
        setActiveContext(null);
        setMessages([]);
      }
    } catch { /* noop */ }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.ctrlKey) { event.preventDefault(); void sendMessage(); }
  };

  const linkedRunLabel = (summary: FollowUpContextSummary): string => {
    return `${summary.name} (${summary.messageCount} msgs)`;
  };

  /** Select or auto-create a follow-up context for a run tab click. */
  const handleSelectRunTab = useCallback(async (job: ReviewJob) => {
    // If there is already a context for this job, just select the most recent one
    const existing = contextSummaries.filter((s) => s.reviewJobId === job.id);
    if (existing.length > 0) {
      const latest = existing.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      setActiveContextId(latest.id);
      return;
    }
    // No context yet – create one
    setCreatingContextForJobId(job.id);
    try {
      const ctx = await api.createFollowUpContext(job);
      setFollowUpError(null);
      const summaries = await api.getFollowUpContexts(pullRequest);
      setContextSummaries(summaries);
      setActiveContextId(ctx.id);
    } catch (error) {
      setFollowUpError(error instanceof Error ? error.message : 'Unable to open follow-up for this review run.');
    } finally {
      setCreatingContextForJobId(null);
    }
  }, [contextSummaries, pullRequest]);

  useEffect(() => {
    if (activeContextId === null) {
      autoSelectRef.current = false;
    }
  }, [activeContextId]);

  useEffect(() => {
    if (layout !== 'tabs') return;
    if (!summariesLoaded) return;
    if (pendingContextId) return;
    if (activeContextId) return;
    if (reviewJobs.length === 0) return;
    if (creatingContextForJobId) return;
    if (autoSelectRef.current) return;
    autoSelectRef.current = true;
    void handleSelectRunTab(reviewJobs[0]);
  }, [
    layout,
    summariesLoaded,
    pendingContextId,
    activeContextId,
    reviewJobs,
    creatingContextForJobId,
    handleSelectRunTab
  ]);

  return (
    <div className={styles.followupPanel} ref={panelRef}>
      {/* Context selector: sidebar (default) or tabs */}
      {layout === 'tabs' ? (
        <div className={styles.followupTabsBar}>
          <i className={`fa-solid fa-comments ${styles.followupTabsIcon}`} aria-hidden="true" />
          {reviewJobs.length === 0 ? (
            <span className={styles.followupTabsEmpty}>No review runs yet.</span>
          ) : (
            reviewJobs.map((job) => {
              const jobContexts = contextSummaries.filter((s) => s.reviewJobId === job.id);
              const totalMsgs = jobContexts.reduce((sum, s) => sum + s.messageCount, 0);
              const isActive = jobContexts.some((s) => s.id === activeContextId);
              const isLoading = creatingContextForJobId === job.id;
              return (
                <button
                  key={job.id}
                  type="button"
                  className={`${styles.followupTabBtn} ${isActive ? styles.active : ''}`}
                  onClick={() => { void handleSelectRunTab(job); }}
                  title={`${getModelDisplayName(job.modelName)} · ${new Date(job.completedAt ?? job.startedAt ?? job.queuedAt).toLocaleString()}${jobContexts.length > 0 ? `\n${jobContexts.length} session(s)` : '\nNo session yet – click to create'}`}
                  disabled={isLoading}
                >
                  <span>
                    {runNumbers?.has(job.id)
                      ? `Run ${runNumbers.get(job.id)} · ${getModelDisplayName(job.modelName)}`
                      : formatRunDate(job.completedAt ?? job.startedAt ?? job.queuedAt)}
                  </span>
                  {isLoading && <i className={`fa-solid fa-spinner fa-spin ${styles.followupTabSpinner}`} aria-hidden="true" />}
                  {!isLoading && totalMsgs > 0 && (
                    <span className={styles.followupTabMsgCount}>{totalMsgs}</span>
                  )}
                </button>
              );
            })
          )}
          {onClose && (
            <button
              type="button"
              className={`${styles.followupTabsClose} ${styles.followupTabsCloseSpacer}`}
              onClick={onClose}
              title="Collapse follow-up panel"
              aria-label="Collapse follow-up panel"
            >
              <i className="fa-solid fa-chevron-down" aria-hidden="true" />
            </button>
          )}
        </div>
      ) : (
        /* Sidebar layout */
        <div className={styles.followupSidebar}>
          {contextSummaries.length === 0 ? (
            <span className={styles.followupSidebarEmpty}>
              No follow-up conversations. Use &quot;Chat about this run&quot; in the Reviews tab to start one.
            </span>
          ) : (
            contextSummaries.map((summary) => (
              <button
                key={summary.id}
                className={`${styles.followupContextBtn} ${activeContextId === summary.id ? styles.active : ''}`}
                onClick={() => setActiveContextId(summary.id)}
                title={`Created: ${new Date(summary.createdAt).toLocaleString()}\nModel: ${getModelDisplayName(summary.modelName)}\nMessages: ${summary.messageCount}`}
              >
                {linkedRunLabel(summary)}
                <span
                  className={styles.followupContextDelete}
                  onClick={(e) => { e.stopPropagation(); setDeleteContextId(summary.id); }}
                  title="Delete conversation"
                >
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </span>
              </button>
            ))
          )}
        </div>
      )}

      <div className={styles.followupContentScroll} ref={messagesContainerRef} onScroll={handleScroll}>
        {/* Context info */}
        {activeContext && (
          <div className={styles.followupContextInfo}>
            Review run: {activeContext.reviewJobId.substring(0, 12)}… · Model: {getModelDisplayName(activeContext.modelName)} · Created: {new Date(activeContext.createdAt).toLocaleString()}
          </div>
        )}

        {followUpError && (
          <div className={styles.followupContextInfo} role="alert">
            {followUpError}
          </div>
        )}

        {activeContext?.sessionAvailable === false && (
          <div className={styles.followupContextInfo} role="status">
            Follow-up is unavailable on this machine for this review run because the local Copilot session could not be resumed.
          </div>
        )}

        {/* Messages */}
        <div className={styles.followupMessages}>
          {!activeContext && messages.length === 0 && (
            <div className={styles.followupEmpty}>
              <div>Select a follow-up conversation or start one from the Reviews tab.</div>
            </div>
          )}

          {(activeContext || messages.length > 0) && (
            <>
              {activeContext && messages.length === 0 && (
                <div className={styles.followupConversationSeparator}>
                  <span>
                    {activeContext.sessionAvailable === false
                      ? 'The original follow-up session is not available on this machine.'
                      : 'This follow-up is attached to a local Copilot session. Earlier turns are not stored in the app.'}
                  </span>
                </div>
              )}

              {messages.map((msg, index) => (
                <div
                  key={`${index}-${msg.role}`}
                  className={msg.role === 'user' ? styles.followupBubbleUser : styles.followupBubbleAssistant}
                >
                  <div className={styles.followupBubbleHeader}>
                    <span>
                      {msg.role === 'user'
                        ? `You${msg.modelName ? ` · ${getModelDisplayName(msg.modelName)}` : ''}`
                        : 'Copilot'}
                    </span>
                    {msg.role === 'assistant' && msg.content && (
                      <button
                        className={styles.followupCopyBtn}
                        onClick={() => { void copyToClipboard(msg.content); }}
                        title="Copy response"
                        aria-label="Copy response"
                      >
                        <i className="fa-regular fa-copy" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div>
                    {msg.role === 'assistant' ? (
                      msg.content ? (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      ) : (
                        isStreaming && index === messages.length - 1 && (
                          <span className={styles.followupStreamingCursor} />
                        )
                      )
                    ) : (
                      <div className={styles.followupUserText}>{msg.content}</div>
                    )}
                    {msg.role === 'assistant' && isStreaming && index === messages.length - 1 && msg.content && (
                      <span className={styles.followupStreamingCursor} />
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area */}
      {activeContext && (
        <>
          <div className={styles.followupInputSplitter} onMouseDown={startResizeInput} />
          <div className={styles.followupInputArea}>
            <div className={styles.followupInputRow}>
              <ModelSelect
                value={modelName}
                options={modelOptions}
                onChange={(value) => setModelName(normalizeSelectableModelId(value))}
                className={`model-select ${styles.followupModelSelect}`}
                keyPrefix="followup"
              />
            </div>
            <div className={`${styles.followupInputRow} ${styles.followupInputMain}`}>
              <textarea
                ref={inputRef}
                className={styles.followupTextarea}
                placeholder="Ask a follow-up question... (Ctrl+Enter to send)"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isStreaming || activeContext.sessionAvailable === false}
              />
              <div className={styles.followupInputButtons}>
                {isStreaming ? (
                  <button className="btn btn-danger" onClick={cancelMessage} title="Cancel">
                    <i className="fa-solid fa-stop" aria-hidden="true" />
                  </button>
                ) : (
                  <button className="btn accent" onClick={sendMessage} disabled={!inputText.trim() || activeContext.sessionAvailable === false} title="Send">
                    <i className="fa-solid fa-paper-plane" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={deleteContextId !== null}
        title="Delete conversation"
        message="Delete this follow-up conversation? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteContextId) void deleteContext(deleteContextId);
          setDeleteContextId(null);
        }}
        onCancel={() => setDeleteContextId(null)}
      />
    </div>
  );
}
