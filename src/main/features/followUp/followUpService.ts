import { EventEmitter } from 'events';
import { CopilotReviewService } from '@main/core/copilot/copilotReviewService';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { ReviewStorageService } from '@main/core/persistence/reviewStorageService';
import { AskMessage, FollowUpContext, FollowUpContextSummary, PullRequestSummary, ReviewJob } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { COPILOT_TIMEOUT_MS } from '@shared/constants/timeouts';
import { getModelDisplayName, normalizeSelectableModelId } from '@shared/constants/modelOptions';

export class FollowUpService extends EventEmitter {
  /** In-memory cache: contextId → FollowUpContext (hydrated from disk on first access). */
  private readonly contexts = new Map<string, FollowUpContext>();
  private readonly controllers = new Map<string, AbortController>();
  private readonly persistedContextIds = new Set<string>();
  /** Track which PRs have been loaded from disk. */
  private readonly loadedPrs = new Set<string>();
  /** Tracks when each context was last accessed, for LRU eviction. */
  private readonly contextLastUsed = new Map<string, number>();
  /** Maximum number of in-memory contexts. */
  private static readonly MAX_CACHED_CONTEXTS = 50;

  constructor(
    private readonly copilotService: CopilotReviewService,
    private readonly reviewStorage: ReviewStorageService,
    private readonly sessionManager?: CopilotSessionManager
  ) {
    super();
  }

  private prKey(pr: PullRequestSummary): string {
    return `${pr.repository}:${pr.id}`;
  }

  /** Ensure contexts for a given PR are loaded from disk into the in-memory cache. */
  private async ensureLoaded(pr: PullRequestSummary): Promise<void> {
    const key = this.prKey(pr);
    if (this.loadedPrs.has(key)) {
      return;
    }
    const persisted = await this.reviewStorage.loadFollowUpContexts(pr);
    for (const ctx of persisted) {
      if (!this.contexts.has(ctx.id)) {
        ctx.isStreaming = false;
        ctx.sessionAvailable = true;
        this.contexts.set(ctx.id, ctx);
        this.persistedContextIds.add(ctx.id);
        this.contextLastUsed.set(ctx.id, Date.now());
      }
    }
    this.loadedPrs.add(key);
    this.evictOldestContexts();
  }

  /** Evict the least-recently-used contexts when the cache exceeds the limit. */
  private evictOldestContexts(): void {
    if (this.contexts.size <= FollowUpService.MAX_CACHED_CONTEXTS) return;

    const entries = Array.from(this.contextLastUsed.entries())
      .sort((a, b) => a[1] - b[1]); // oldest first

    const toEvict = entries.slice(0, this.contexts.size - FollowUpService.MAX_CACHED_CONTEXTS);
    for (const [id] of toEvict) {
      // Don't evict contexts that are currently streaming
      const ctx = this.contexts.get(id);
      if (ctx?.isStreaming) continue;
      this.contexts.delete(id);
      this.contextLastUsed.delete(id);
    }
  }

  async createContext(job: ReviewJob, modelName?: string): Promise<FollowUpContext> {
    if (!job.reviewResponse && job.persistedResult) {
      throw new Error('Follow-up is unavailable on this machine for this review run.');
    }

    await this.ensureLoaded(job.pullRequest);

    const existing = Array.from(this.contexts.values())
      .filter((ctx) =>
        ctx.pullRequest.id === job.pullRequest.id
        && ctx.pullRequest.repository === job.pullRequest.repository
        && ctx.reviewJobId === job.id
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

    if (existing) {
      const normalizedModelName = modelName ? normalizeSelectableModelId(modelName) : null;
      if (normalizedModelName && normalizedModelName !== existing.modelName) {
        existing.modelName = normalizedModelName;
      }
      existing.reviewSessionOptions = job.reviewSessionOptions ?? existing.reviewSessionOptions ?? null;
      existing.effectiveContextMode = job.effectiveContextMode ?? existing.effectiveContextMode ?? null;
      existing.fallbackReason = job.fallbackReason ?? existing.fallbackReason ?? null;
      try { await this.reviewStorage.saveFollowUpContext(existing); } catch { /* non-blocking */ }
      await this.refreshSessionAvailability(existing);
      return existing;
    }

    const id = `followup-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const runLabel = getModelDisplayName(job.modelName);
    const context: FollowUpContext = {
      id,
      name: `Follow-up · ${runLabel}`,
      pullRequest: job.pullRequest,
      reviewJobId: job.id,
      initialPrompt: job.prompt,
      initialResponse: this.buildFullInitialResponse(job),
      modelName: normalizeSelectableModelId(modelName ?? job.modelName),
      messages: [],
      isStreaming: false,
      sessionAvailable: true,
      reviewSessionOptions: job.reviewSessionOptions ?? null,
      effectiveContextMode: job.effectiveContextMode ?? null,
      fallbackReason: job.fallbackReason ?? null,
      createdAt: new Date().toISOString()
    };

    this.contexts.set(id, context);
    this.contextLastUsed.set(id, Date.now());

    // Persist immediately
    try { await this.reviewStorage.saveFollowUpContext(context); } catch { /* non-blocking */ }

    return context;
  }

  async deleteContext(pr: PullRequestSummary, contextId: string): Promise<void> {
    this.cancelMessage(contextId);
    this.contexts.delete(contextId);
    this.contextLastUsed.delete(contextId);
    this.persistedContextIds.delete(contextId);
    // Clean up the persistent Copilot session
    if (this.sessionManager) {
      await this.sessionManager.deleteSession(CopilotSessionManager.followUpKey(contextId));
    }
    try { await this.reviewStorage.deleteFollowUpContext(pr, contextId); } catch { /* non-blocking */ }
  }

  async purgePullRequest(pr: PullRequestSummary): Promise<void> {
    for (const [contextId, context] of this.contexts.entries()) {
      const samePr = context.pullRequest.id === pr.id && context.pullRequest.repository === pr.repository;
      if (!samePr) {
        continue;
      }
      this.cancelMessage(contextId);
      // Clean up the persistent Copilot session
      if (this.sessionManager) {
        await this.sessionManager.deleteSession(CopilotSessionManager.followUpKey(contextId));
      }
      this.contexts.delete(contextId);
      this.contextLastUsed.delete(contextId);
      this.persistedContextIds.delete(contextId);
    }

    this.loadedPrs.delete(this.prKey(pr));
    try { await this.reviewStorage.deleteFollowUpsForPullRequest(pr); } catch { /* non-blocking */ }
  }

  async purgeReviewJob(pr: PullRequestSummary, jobId: string): Promise<void> {
    const contextIds = new Set<string>();

    for (const [contextId, context] of this.contexts.entries()) {
      const samePr = context.pullRequest.id === pr.id && context.pullRequest.repository === pr.repository;
      if (!samePr || context.reviewJobId !== jobId) {
        continue;
      }

      this.cancelMessage(contextId);
      this.contexts.delete(contextId);
      this.contextLastUsed.delete(contextId);
      this.persistedContextIds.delete(contextId);
      contextIds.add(contextId);
    }

    try {
      const persistedIds = await this.reviewStorage.getFollowUpContextIdsForReviewJob(jobId);
      for (const contextId of persistedIds) {
        contextIds.add(contextId);
      }
      await this.reviewStorage.deleteFollowUpsForReviewJob(jobId);
    } catch {
      // Non-blocking.
    }

    if (this.sessionManager) {
      for (const contextId of contextIds) {
        await this.sessionManager.deleteSession(CopilotSessionManager.followUpKey(contextId));
      }
    }
  }

  clearAllCache(): void {
    for (const contextId of this.contexts.keys()) {
      this.cancelMessage(contextId);
    }
    this.contexts.clear();
    this.contextLastUsed.clear();
    this.persistedContextIds.clear();
    this.loadedPrs.clear();
  }

  async getContextSummaries(pr: PullRequestSummary): Promise<FollowUpContextSummary[]> {
    await this.ensureLoaded(pr);

    const scoped = Array.from(this.contexts.values())
      .filter((ctx) => ctx.pullRequest.id === pr.id && ctx.pullRequest.repository === pr.repository)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const latestByReviewJob = new Map<string, FollowUpContext>();
    for (const ctx of scoped) {
      if (!latestByReviewJob.has(ctx.reviewJobId)) {
        latestByReviewJob.set(ctx.reviewJobId, ctx);
      }
    }

    return Array.from(latestByReviewJob.values()).map((ctx) => ({
      id: ctx.id,
      name: ctx.name,
      pullRequestId: ctx.pullRequest.id,
      reviewJobId: ctx.reviewJobId,
      modelName: ctx.modelName,
      messageCount: ctx.messages.length > 0 ? ctx.messages.length : (ctx.persistedMessageCount ?? 0),
      createdAt: ctx.createdAt
    }));
  }

  async getContext(pr: PullRequestSummary, contextId: string): Promise<FollowUpContext | null> {
    await this.ensureLoaded(pr);
    const context = this.contexts.get(contextId) ?? null;
    if (!context) {
      return null;
    }

    const samePr = context.pullRequest.id === pr.id && context.pullRequest.repository === pr.repository;
    if (samePr) {
      this.contextLastUsed.set(contextId, Date.now());
      await this.refreshSessionAvailability(context);
    }
    return samePr ? context : null;
  }

  cancelMessage(contextId: string): void {
    const controller = this.controllers.get(contextId);
    if (controller) {
      controller.abort();
      this.controllers.delete(contextId);
    }
    const context = this.contexts.get(contextId);
    if (context) {
      context.isStreaming = false;
    }
  }

  async sendMessage(contextId: string, userMessage: string, modelName?: string): Promise<string> {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`Follow-up context ${contextId} not found.`);
    }
    if (!userMessage.trim()) {
      throw new Error('Message is empty.');
    }

    if (modelName) {
      context.modelName = normalizeSelectableModelId(modelName);
    }

    await this.refreshSessionAvailability(context);
    if (context.sessionAvailable === false) {
      throw new Error('Follow-up is unavailable on this machine for this review run.');
    }

    const userMsg: AskMessage = {
      role: 'user',
      content: userMessage.trim(),
      timestamp: new Date().toISOString(),
      modelName: normalizeSelectableModelId(context.modelName)
    };
    context.messages.push(userMsg);

    const assistantMsg: AskMessage = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      modelName: normalizeSelectableModelId(context.modelName)
    };
    context.messages.push(assistantMsg);
    context.isStreaming = true;

    const prompt = this.buildConversationPrompt(context);

    // Use persistent session if available — only send the current user message
    // (the SDK session remembers prior turns natively).
    // Fall back to the legacy full-prompt approach if no session manager.
    const sessionKey = this.sessionManager
      ? CopilotSessionManager.followUpKey(contextId)
      : undefined;
    const canResumeSession = sessionKey
      ? await this.sessionManager?.canResumeSession(sessionKey, context.modelName)
      : false;

    const promptToSend = sessionKey
      ? (canResumeSession ? userMessage.trim() : prompt)
      : prompt;

    const controller = new AbortController();
    this.controllers.set(contextId, controller);

    try {
      const response = await this.copilotService.requestReview(
        promptToSend,
        context.modelName,
        {
          onDelta: (delta, fullText) => {
            assistantMsg.content = fullText;
            this.emit(IpcChannels.FOLLOW_UP_DELTA, { contextId, delta, fullText });
          },
          signal: controller.signal,
          timeoutMs: COPILOT_TIMEOUT_MS,
          sessionKey,
          reviewSessionOptions: context.reviewSessionOptions ?? undefined
        }
      );

      assistantMsg.content = response;
      assistantMsg.timestamp = new Date().toISOString();
      context.isStreaming = false;
      this.controllers.delete(contextId);

      // Persist after completion
      try { await this.reviewStorage.saveFollowUpContext(context); } catch { /* non-blocking */ }

      this.emit(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, { contextId });
      return response;
    } catch (error: any) {
      context.isStreaming = false;
      this.controllers.delete(contextId);

      if (controller.signal.aborted) {
        if (!assistantMsg.content) {
          context.messages.pop();
        }
        // Persist partial state
        try { await this.reviewStorage.saveFollowUpContext(context); } catch { /* non-blocking */ }
        this.emit(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, { contextId });
        throw new Error('Request canceled.');
      }

      assistantMsg.content = `Error: ${error?.message ?? String(error)}`;
      // Persist error state
      try { await this.reviewStorage.saveFollowUpContext(context); } catch { /* non-blocking */ }
      this.emit(IpcChannels.FOLLOW_UP_MESSAGE_COMPLETE, { contextId });
      throw error;
    }
  }

  private async refreshSessionAvailability(context: FollowUpContext): Promise<void> {
    const hasPersistedBaseContext = Boolean(context.initialPrompt.trim() && context.initialResponse.trim());
    if (!this.persistedContextIds.has(context.id)) {
      context.sessionAvailable = true;
      return;
    }

    if (!this.sessionManager) {
      context.sessionAvailable = hasPersistedBaseContext;
      return;
    }

    const canResumeSession = await this.sessionManager.canResumeSession(
      CopilotSessionManager.followUpKey(context.id),
      context.modelName
    );
    context.sessionAvailable = canResumeSession || hasPersistedBaseContext;
  }

  private buildConversationPrompt(context: FollowUpContext): string {
    const reviewContextLines = this.buildReviewContextLines(context);
    const parts: string[] = [
      'You are a helpful code review assistant. The user is following up on a code review.',
      'You have access to the original code review prompt (which includes the code diffs) and the review results.',
      'Answer the user\'s questions clearly and concisely based on this context.',
      'Use Markdown formatting for your responses when appropriate (code blocks, lists, bold, etc.).',
      '',
      ...reviewContextLines,
      '=== ORIGINAL CODE REVIEW PROMPT (includes diffs) ===',
      context.initialPrompt,
      '',
      '=== CODE REVIEW RESULTS ===',
      context.initialResponse,
      ''
    ];

    for (const msg of context.messages) {
      if (msg.role === 'user') {
        parts.push(`User: ${msg.content}`);
      } else if (msg.role === 'assistant' && msg.content) {
        parts.push(`Assistant: ${msg.content}`);
      }
    }

    // The last message is the empty assistant placeholder; remove it from prompt
    if (parts[parts.length - 1] === 'Assistant: ') {
      parts.pop();
    }

    return parts.join('\n');
  }

  /**
   * Build a combined initial response that includes recent review passes
   * from the job's history plus the current (latest) response.
   * Only includes the last 3 history entries to prevent unbounded growth.
   */
  private buildFullInitialResponse(job: ReviewJob): string {
    const history = job.reviewHistory ?? [];
    // Only include the most recent history entries to keep context size manageable
    const recentHistory = history.slice(-3);
    const parts: string[] = [];

    if (recentHistory.length < history.length) {
      parts.push(`[... ${history.length - recentHistory.length} earlier review attempt(s) omitted ...]`, '');
    }

    for (const entry of recentHistory) {
      parts.push(
        `--- Review attempt #${entry.attempt} (${new Date(entry.completedAt).toLocaleString()}) ---`,
        entry.response,
        ''
      );
    }

    // Current / latest response
    const currentAttempt = history.length + 1;
    if (job.reviewResponse) {
      if (history.length > 0) {
        parts.push(
          `--- Review attempt #${currentAttempt} (latest${job.completedAt ? ' — ' + new Date(job.completedAt).toLocaleString() : ''}) ---`
        );
      }
      parts.push(job.reviewResponse);
    }

    return parts.join('\n');
  }

  private buildReviewContextLines(context: FollowUpContext): string[] {
    if (context.effectiveContextMode === 'branch-aware') {
      return [
        '=== ORIGINAL REVIEW EXECUTION CONTEXT ===',
        'The original review ran in branch-aware mode with read-only repository context available.',
        'Keep follow-up answers focused on the same pull request and reuse that repository context when the current session still has access to it.',
        ''
      ];
    }

    if (context.reviewSessionOptions?.requestedContextMode === 'branch-aware' && context.fallbackReason) {
      return [
        '=== ORIGINAL REVIEW EXECUTION CONTEXT ===',
        'The original review requested branch-aware mode, but it fell back to diff-only execution.',
        `Fallback reason: ${context.fallbackReason}`,
        ''
      ];
    }

    return [];
  }
}
