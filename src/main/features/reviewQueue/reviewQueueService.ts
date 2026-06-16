import { EventEmitter } from 'events';
import { existsSync, statSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { CopilotReviewService } from '@main/core/copilot/copilotReviewService';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { PullRequestChangesService } from '@main/features/pullRequests/pullRequestChangesService';
import { ReviewWorktreeService } from '@main/features/reviewWorktree/reviewWorktreeService';
import {
  formatAttemptUsageSummaryLog,
  formatUsageSnapshotLog,
  ReviewAttemptUsageAggregator
} from '@main/core/copilot/reviewUsageAggregation';
import { AppSettings, PullRequestFileDiff, PullRequestSummary, ReviewContextMode, ReviewJob, ReviewJobStatus, ReviewPromptContext, ReviewSessionOptions } from '@shared/types/models';
import { ReviewStorageService } from '@main/core/persistence/reviewStorageService';
import { SkillsService } from '@main/features/skills/skillsService';
import { buildFindingsSummary } from '@main/utils/parseReview';
import { normalizeSelectableModelId } from '@shared/constants/modelOptions';
import { COPILOT_TIMEOUT_MS } from '@shared/constants/timeouts';
import { buildPrChangeBoundaryBlock } from '@shared/utils/prContext';
import { buildSkillProjectKeyCandidates } from '@shared/utils/skillProjectKey';

/** Maximum number of history entries per review job. */
const MAX_REVIEW_HISTORY = 10;
/** Maximum number of completed/failed jobs kept in memory. */
const MAX_FINISHED_JOBS_IN_MEMORY = 100;
/** Max chars of diff text per batch. */
const MAX_DIFF_CHARS_PER_BATCH = 120_000;
/** If a single file diff exceeds this, it is truncated with a notice. */
const MAX_SINGLE_FILE_CHARS = 100_000;

export class ReviewQueueService extends EventEmitter {
  private readonly jobs: ReviewJob[] = [];
  private running = 0;
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly copilotReviewService: CopilotReviewService,
    private readonly settings: () => AppSettings,
    private readonly reviewStorage?: ReviewStorageService,
    private readonly pullRequestChangesService?: PullRequestChangesService,
    private readonly reviewWorktreeService?: ReviewWorktreeService,
    private readonly sessionManager?: CopilotSessionManager,
    private readonly skillsService?: SkillsService
  ) {
    super();
  }

  getJobs(): ReviewJob[] {
    // Strip only reviewHistory for completed jobs to reduce IPC serialization cost.
    // Keep lastSentPrompt + debugLogs so the Tasks results UI can display them.
    return this.jobs.map((job) => {
      if (job.status === 'Running') return job;
      if (!job.reviewHistory?.length) return job;
      const light = { ...job };
      delete light.reviewHistory;
      return light as ReviewJob;
    });
  }

  clearResults(pullRequestId?: number | null) {
    if (!pullRequestId) {
      this.jobs.length = 0;
      this.emit('changed');
      return;
    }

    // Also clean up Copilot sessions for this PR
    if (this.sessionManager) {
      const pr = this.jobs.find((j) => j.pullRequest.id === pullRequestId)?.pullRequest;
      if (pr) {
        void this.sessionManager.deleteSessionsForPr(pr.repository, pr.id);
      }
    }

    const remaining = this.jobs.filter((job) => job.pullRequest.id !== pullRequestId);
    this.jobs.length = 0;
    this.jobs.push(...remaining);
    this.emit('changed');
  }

  deleteJob(jobId: string) {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) {
      return;
    }

    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
      this.controllers.delete(jobId);
    }

    this.jobs.splice(index, 1);
    this.emit('changed');
  }

  hideFinishedInQueue() {
    const finished = new Set<ReviewJobStatus>(['Completed', 'Failed', 'Canceled']);
    for (const job of this.jobs) {
      if (finished.has(job.status)) {
        job.hiddenInQueue = true;
      }
    }
    this.emit('changed');
  }

  showAllInQueue() {
    for (const job of this.jobs) {
      job.hiddenInQueue = false;
    }
    this.emit('changed');
  }

  enqueueReview(pullRequest: PullRequestSummary, prompt: string, modelName?: string | null, batchLabel?: string | null, batchPrompts?: string[] | null, forceNewSession?: boolean, selectedSkillIds?: string[], reviewSessionOptions?: ReviewSessionOptions | null, reviewPromptContext?: ReviewPromptContext | null) {
    const effectiveModel = normalizeSelectableModelId(modelName);
    const normalizedReviewSessionOptions = normalizeReviewSessionOptions(reviewSessionOptions);

    // ── Look for an existing job for the same PR + same model ─────
    // If one exists, re-queue it instead of creating a duplicate run.
    const existing = !forceNewSession ? this.jobs.find(
      (j) =>
        j.pullRequest.id === pullRequest.id &&
        j.pullRequest.repository === pullRequest.repository &&
        normalizeSelectableModelId(j.modelName) === effectiveModel &&
        (j.taskType ?? 'Code review') === inferTaskType(prompt) &&
        buildReviewSessionOptionsKey(j.reviewSessionOptions) === buildReviewSessionOptionsKey(normalizedReviewSessionOptions)
    ) : undefined;

    if (existing) {
      // Already running or queued — nothing to do, return the existing job
      if (existing.status === 'Running' || existing.status === 'Queued') {
        return existing;
      }

      // Re-queue an already-finished job (Completed / Failed / Canceled)
      // ── Save the current response into the review history ──────
      if (existing.status === 'Completed' && existing.reviewResponse) {
        if (!existing.reviewHistory) {
          existing.reviewHistory = [];
        }
        existing.reviewHistory.push({
          attempt: existing.reviewHistory.length + 1,
          prompt: existing.prompt,
          sentPrompt: existing.lastSentPrompt ?? existing.prompt,
          response: existing.reviewResponse,
          startedAt: existing.startedAt ?? existing.queuedAt,
          completedAt: existing.completedAt ?? new Date().toISOString(),
          attemptUsageSummary: existing.attemptUsageSummary,
          isReReview: existing.isReReview,
          sessionKey: existing.sessionKey ?? undefined
        });
        // Cap history to prevent unbounded memory growth
        if (existing.reviewHistory.length > MAX_REVIEW_HISTORY) {
          existing.reviewHistory = existing.reviewHistory.slice(-MAX_REVIEW_HISTORY);
        }
      }

      existing.prompt = prompt;
      existing.batchLabel = batchLabel ?? existing.batchLabel;
      existing.batchPrompts = batchPrompts ?? null;
      existing.selectedGlobalSkillIds = selectedSkillIds ?? existing.selectedGlobalSkillIds;
      existing.reviewSessionOptions = normalizedReviewSessionOptions ?? null;
      existing.reviewPromptContext = reviewPromptContext ?? null;
      existing.effectiveContextMode = null;
      existing.fallbackReason = null;
      existing.activePhaseLabel = null;
      existing.status = 'Queued';
      existing.progressPercent = 0;
      existing.errorMessage = null;
      existing.queuedAt = new Date().toISOString();
      existing.startedAt = null;
      existing.completedAt = null;
      existing.hiddenInQueue = false;
      existing.attemptUsageSummary = undefined;
      // Keep existing.reviewResponse — it will be replaced when processing starts

      this.emit('changed');
      void this.processQueue();
      return existing;
    }

    // ── No existing job — create a new one ────────────────────────
    const job: ReviewJob = {
      id: `J${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      pullRequest,
      taskType: inferTaskType(prompt),
      prompt,
      modelName: effectiveModel,
      batchLabel: batchLabel ?? null,
      batchPrompts: batchPrompts ?? null,
      forceNewSession: forceNewSession ?? false,
      selectedGlobalSkillIds: selectedSkillIds ?? null,
      reviewSessionOptions: normalizedReviewSessionOptions ?? null,
      reviewPromptContext: reviewPromptContext ?? null,
      effectiveContextMode: null,
      fallbackReason: null,
      activePhaseLabel: null,
      status: 'Queued',
      progressPercent: 0,
      queuedAt: new Date().toISOString()
    };
    this.jobs.unshift(job);
    this.emit('changed');
    void this.processQueue();
    return job;
  }

  async generateSummary(prompt: string, modelName?: string | null): Promise<string> {
    // Use a unique, one-time session key so the summary never shares
    // context with review sessions, but still uses the shared CopilotClient.
    const ephemeralKey = `summary:${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    try {
      return await this.copilotReviewService.requestReview(prompt, modelName ?? undefined, {
        timeoutMs: COPILOT_TIMEOUT_MS,
        sessionKey: this.sessionManager ? ephemeralKey : undefined
      });
    } finally {
      // Clean up the one-off session immediately.
      if (this.sessionManager) {
        void this.sessionManager.deleteSession(ephemeralKey);
      }
    }
  }

  // Kept for backward compatibility with IPC; persistence is fetched separately.
  async reloadPersisted(): Promise<void> {
    return;
  }

  cancelJob(jobId: string) {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job || job.status === 'Completed' || job.status === 'Failed' || job.status === 'Canceled') {
      return;
    }
    if (job.status === 'Queued') {
      this.setStatus(job, 'Canceled');
      this.emit('changed');
      return;
    }
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
    }
    this.setStatus(job, 'Canceled');
    this.emit('changed');
  }

  private async processQueue() {
    // Always process one job at a time (sequential execution).
    if (this.running >= 1) {
      return;
    }

    const next = this.jobs.find((job) => job.status === 'Queued');
    if (!next) {
      return;
    }

    this.running++;
    this.setStatus(next, 'Running');
    this.setProgress(next, 10);
    next.reviewResponse = '';
    const controller = new AbortController();
    this.controllers.set(next.id, controller);
    let unsubscribeLogs: (() => void) | undefined;
    let cleanupTempDirs: (() => void) | null = null;
    const usageAggregator = new ReviewAttemptUsageAggregator();

    try {
      if (!next.prompt.trim()) {
        throw new Error('Prompt is empty.');
      }

      const taskType = next.taskType ?? inferTaskType(next.prompt);
      const isSummaryTask = taskType === 'Changes summary';

      // Code review: shared per-(PR, model) session.
      // Changes summary: always use a one-off dedicated session (never shared).
      // forceNewSession: always create a fresh one-off session.
      let sessionKey: string;
      if (isSummaryTask || next.forceNewSession) {
        sessionKey = `${isSummaryTask ? 'summary' : 'review'}:${next.pullRequest.repository}:${next.pullRequest.id}:${normalizeSelectableModelId(next.modelName)}:${next.id}:${Date.now()}`;
      } else {
        sessionKey = CopilotSessionManager.reviewKey(
          next.pullRequest.repository,
          next.pullRequest.id,
          next.modelName
        );
      }

      const isReReview = !isSummaryTask && !next.forceNewSession && (this.sessionManager?.hasExistingSession(sessionKey) ?? false);

      const debugLog = (msg: string) => {
        const ts = new Date().toISOString().slice(11, 23);
        const line = `[${ts}] ${msg}`;
        if (!next.debugLogs) next.debugLogs = [];
        next.debugLogs.push(line);
      };

      debugLog(`Processing job ${next.id}: PR #${next.pullRequest.id} (${taskType}, model: ${normalizeSelectableModelId(next.modelName)}, session: "${sessionKey}", re-review: ${isReReview})`);

      const resolvedContext = isSummaryTask
        ? this.resolveSummaryContext(next.reviewSessionOptions)
        : await this.resolveReviewContext(next, debugLog);

      // Store session metadata on the job for UI display.
      next.isReReview = isReReview;
      next.sessionKey = sessionKey;
      next.reviewSessionOptions = resolvedContext.reviewSessionOptions ?? null;
      next.effectiveContextMode = resolvedContext.effectiveContextMode;
      next.fallbackReason = resolvedContext.fallbackReason ?? null;
      this.setActivePhase(next, null, false);
      const reviewWorkingDirectory = next.reviewSessionOptions?.workingDirectory?.trim() || null;
      debugLog(`Review context: requested=${resolvedContext.requestedContextMode}, applied=${resolvedContext.effectiveContextMode}`);
      if (resolvedContext.fallbackReason) {
        debugLog(`Review context fallback: ${resolvedContext.fallbackReason}`);
      }
      debugLog(reviewWorkingDirectory
        ? `Session workspace: repository-backed (${reviewWorkingDirectory})`
        : 'Session workspace: isolated Copilot home');

      // ── Resolve skills for this review ─────────────────────────
      let skillDirectories: string[] | undefined;
      let disabledSkills: string[] | undefined;
      let expectedMarkers: Array<{ skillName: string; marker: string }> = [];

      if (!isSummaryTask && this.skillsService) {
        try {
          // Determine the project key from the active PR source settings
          const currentSettings = this.settings();
          const sourceId = currentSettings.activePrSourceId;
          const source = currentSettings.prSources?.find((s) => s.id === sourceId);
          const org = source ? currentSettings.organizations?.find((o) => o.id === source.organizationId) : null;
          const projectKeys = org && source
            ? buildSkillProjectKeyCandidates(org.name, source.project)
            : [];
          const primaryProjectKey = projectKeys[0] ?? null;
          const legacyProjectKey = projectKeys[1] ?? null;

          debugLog(`Resolving skills for project key: ${primaryProjectKey ?? '(none)'}, org: ${org?.id ?? '(none)'}`);

          let resolved = await this.skillsService.resolveSkillsForReview(
            primaryProjectKey,
            org?.id ?? null,
            next.selectedGlobalSkillIds
          );

          if (resolved.skillDirectories.length === 0 && legacyProjectKey) {
            debugLog(`No skills found for canonical key; retrying with legacy key: ${legacyProjectKey}`);
            resolved = await this.skillsService.resolveSkillsForReview(
              legacyProjectKey,
              org?.id ?? null,
              next.selectedGlobalSkillIds
            );
          }

          if (resolved.skillDirectories.length > 0) {
            skillDirectories = resolved.skillDirectories;
            disabledSkills = resolved.disabledSkills;
            expectedMarkers = resolved.expectedMarkers;
            cleanupTempDirs = resolved.cleanupTempDirs;
            next.activeSkills = resolved.expectedMarkers.map((m) => m.skillName);

            for (const dir of skillDirectories) {
              debugLog(`  skill dir: ${dir}`);
            }
            debugLog(`Resolved ${skillDirectories.length} skill dir(s), ${expectedMarkers.length} marker(s)`);
          } else {
            debugLog(`No skills available — proceeding without skills`);
          }
        } catch (err) {
          debugLog(`Skill resolution failed: ${err instanceof Error ? err.message : String(err)} — proceeding without skills`);
        }
      }

      const preparedPrompts = isSummaryTask
        ? { prompts: [next.prompt], changedFileCount: 0 }
        : await this.buildReviewPrompts(next, debugLog);
      const [primaryPrompt, ...followUpPrompts] = preparedPrompts.prompts;
      if (!primaryPrompt?.trim()) {
        throw new Error('Review prompt is empty after applying the review context.');
      }

      // Code review can use re-review/cross-model context.
      // Changes summary must remain isolated and use the raw summary prompt only.
      const promptToSend = isSummaryTask
        ? primaryPrompt
        : (isReReview ? this.buildReReviewPrompt(next, primaryPrompt) : this.buildCrossModelPrompt(next, primaryPrompt));

      // Store the full prompt actually sent to the API so it can be inspected later.
      next.lastSentPrompt = promptToSend;
      debugLog(`Prompt built (${promptToSend.length} chars, type: ${isReReview ? 're-review' : isSummaryTask ? 'summary' : 'initial'})`);
      this.emit('changed');

      // ── Subscribe to SDK debug logs for this job ───────────────
      if (this.sessionManager) {
        unsubscribeLogs = this.sessionManager.onLog((line) => {
          if (!next.debugLogs) next.debugLogs = [];
          next.debugLogs.push(line);
          this.emit('changed');
        });
      }

      // ── Determine all prompts to send ──────────────────────────
      // For multi-batch reviews, the first prompt is the main one; the rest
      // are follow-up batch prompts sent sequentially in the same session.
      const allPrompts = [promptToSend, ...followUpPrompts];
      const totalBatches = allPrompts.length;
      let combinedResponse = '';

      this.setActivePhase(next, 'Reviewing pull request...', false);
      debugLog(`Sending ${totalBatches} batch(es) — prompt: ${promptToSend.length} chars`);

      for (let i = 0; i < allPrompts.length; i++) {
        if (controller.signal.aborted) break;

        const batchPrompt = allPrompts[i];
        // Update progress proportionally across batches
        const progressStart = 20 + Math.floor((70 * i) / totalBatches);
        this.setProgress(next, progressStart);

        if (totalBatches > 1 && i > 0) {
          // Visual separator between batch responses
          combinedResponse += '\n\n---\n\n';
          next.reviewResponse = combinedResponse;
          this.emit('changed');
        }

        const beforeLen = combinedResponse.length;
        const batchResponse = await this.copilotReviewService.requestReview(
          batchPrompt,
          normalizeSelectableModelId(next.modelName),
          {
            onDelta: (delta) => {
              combinedResponse += delta;
              next.reviewResponse = combinedResponse;
              this.emit('changed');
            },
            onUsage: (payload) => {
              const snapshot = usageAggregator.add(payload);
              if (snapshot) {
                debugLog(formatUsageSnapshotLog(snapshot));
              }
            },
            signal: controller.signal,
            timeoutMs: COPILOT_TIMEOUT_MS,
            sessionKey,
            skillDirectories,
            disabledSkills,
            reviewSessionOptions: next.reviewSessionOptions ?? undefined
          }
        );

        // If onDelta didn't fire (non-streaming), append the final response
        if (combinedResponse.length === beforeLen && batchResponse) {
          combinedResponse += batchResponse;
          next.reviewResponse = combinedResponse;
          this.emit('changed');
        }
      }

      next.reviewResponse = combinedResponse || next.reviewResponse;
      next.attemptUsageSummary = usageAggregator.toSummary(normalizeSelectableModelId(next.modelName)) ?? undefined;
      if (next.attemptUsageSummary) {
        debugLog(formatAttemptUsageSummaryLog(next.attemptUsageSummary));
      }

      // ── Verify skill execution markers ─────────────────────────
      if (expectedMarkers.length > 0 && this.skillsService && next.reviewResponse) {
        const markerResults = this.skillsService.verifyMarkers(next.reviewResponse, expectedMarkers);
        next.skillMarkerResults = markerResults;
        const found = markerResults.filter((m) => m.found).length;
        debugLog(`Skill markers: ${found}/${markerResults.length} found`);
      }

      this.setProgress(next, 100);
      this.setActivePhase(next, null, false);
      this.setStatus(next, 'Completed', false);
      debugLog(`Job completed — response: ${(next.reviewResponse ?? '').length} chars`);

      // Summary sessions are one-off and must never be reused.
      if (isSummaryTask && this.sessionManager) {
        try {
          await this.sessionManager.deleteSession(sessionKey);
        } catch {
          // Non-blocking.
        }
      }

      try {
        await this.reviewStorage?.appendJob(next);
      } catch (error) {
        console.error(`[ReviewQueue] Failed to persist completed job ${next.id}:`, error);
      }

      this.emit('changed');
    } catch (error: any) {
      next.attemptUsageSummary = usageAggregator.toSummary(normalizeSelectableModelId(next.modelName)) ?? undefined;
      if (next.attemptUsageSummary) {
        debugLog(formatAttemptUsageSummaryLog(next.attemptUsageSummary));
      }
      if (controller.signal.aborted) {
        debugLog('Job canceled by user');
        next.errorMessage = 'Canceled.';
        this.setActivePhase(next, null, false);
        this.setStatus(next, 'Canceled');
      } else {
        debugLog(`Job FAILED: ${error?.message ?? String(error)}`);
        console.error(`[ReviewQueue] Job ${next.id} failed: ${error?.message ?? String(error)}`);
        next.errorMessage = error?.message ?? String(error);
        this.setActivePhase(next, null, false);
        this.setStatus(next, 'Failed', false);

        try {
          await this.reviewStorage?.appendJob(next);
        } catch (persistError) {
          console.error(`[ReviewQueue] Failed to persist failed job ${next.id}:`, persistError);
        }

        this.emit('changed');
      }
    } finally {
      if (unsubscribeLogs) unsubscribeLogs();
      if (cleanupTempDirs) cleanupTempDirs();
      this.running--;
      this.controllers.delete(next.id);
      next.activePhaseLabel = null;

      // Best-effort cleanup for summary sessions.
      const finalTaskType = next.taskType ?? inferTaskType(next.prompt);
      if (finalTaskType === 'Changes summary' && next.sessionKey && this.sessionManager) {
        try {
          await this.sessionManager.deleteSession(next.sessionKey);
        } catch {
          // Non-blocking.
        }
      }

      this.emit('changed');
      this.pruneFinishedJobs();
      void this.processQueue();
    }
  }

  /** Remove oldest completed/failed/canceled jobs from memory when exceeding the cap. */
  private pruneFinishedJobs(): void {
    const finishedStatuses = new Set<string>(['Completed', 'Failed', 'Canceled']);
    const finished = this.jobs.filter((j) => finishedStatuses.has(j.status));
    if (finished.length <= MAX_FINISHED_JOBS_IN_MEMORY) return;

    finished.sort((a, b) => {
      const aTime = new Date(a.completedAt ?? a.queuedAt).getTime();
      const bTime = new Date(b.completedAt ?? b.queuedAt).getTime();
      return aTime - bTime;
    });

    const toRemove = new Set(
      finished.slice(0, finished.length - MAX_FINISHED_JOBS_IN_MEMORY).map((j) => j.id)
    );

    if (toRemove.size > 0) {
      for (let i = this.jobs.length - 1; i >= 0; i--) {
        if (toRemove.has(this.jobs[i].id)) {
          this.jobs.splice(i, 1);
        }
      }
    }
  }

  private setStatus(job: ReviewJob, status: ReviewJobStatus, emit = true) {
    job.status = status;
    if (status === 'Running') {
      job.startedAt = new Date().toISOString();
    }
    if (status === 'Completed' || status === 'Failed') {
      job.completedAt = new Date().toISOString();
    }
    if (emit) {
      this.emit('changed');
    }
  }

  private setProgress(job: ReviewJob, percent: number) {
    job.progressPercent = Math.max(0, Math.min(100, percent));
    this.emit('changed');
  }

  private setActivePhase(job: ReviewJob, label: string | null, emit = true) {
    job.activePhaseLabel = label;
    if (emit) {
      this.emit('changed');
    }
  }

  /**
   * Build a prompt for a re-review on an existing session.
   *
   * The SDK session already contains prior review results and any earlier
   * runtime review context from the conversation history. We keep the current
   * prompt contract for the new run, but instruct the model to build on its
   * prior analysis rather than starting from scratch.
   *
   * Also injects cross-model findings from other models if available.
   */
  private buildReReviewPrompt(job: ReviewJob, prompt: string): string {
    const basePrompt = this.buildCrossModelPrompt(job, prompt);
    const attemptNumber = (job.reviewHistory?.length ?? 0) + 2; // +2 because attempt 1 was the first review
    const timestamp = new Date().toISOString();

    const reReviewPreamble = [
      '=== NEW REVIEW PASS (attempt #' + attemptNumber + ') ===',
      `Timestamp: ${timestamp}`,
      `Session key: ${job.sessionKey ?? 'unknown'}`,
      '',
      'IMPORTANT: This is a brand new review request (attempt #' + attemptNumber + ').',
      'You have already reviewed this pull request in this conversation history.',
      'The user is explicitly asking you to perform the review AGAIN.',
      '',
      'You MUST:',
      '  1. Produce a COMPLETE, standalone review result in the same JSON format as before.',
      '  2. Build on your prior analysis — go deeper, catch things you missed.',
      '  3. Do NOT refuse or say you already reviewed this. The user wants a new pass.',
      '  4. Do NOT return an empty response.',
      '  5. Include a "reviewMetadata" field in your JSON output with:',
      '     {',
      '       "attemptNumber": ' + attemptNumber + ',',
      '       "sessionReused": true,',
      '       "priorFindingsAcknowledged": "<one sentence summarizing what you found in your prior review>"',
      '     }',
      '',
      '=== END FOLLOW-UP CONTEXT ===',
      ''
    ].join('\n');

    return `${reReviewPreamble}\n${basePrompt}`;
  }

  /**
   * Build a prompt that includes cross-model findings from other completed
   * reviews of the same PR (by ANY model, including the same one when using
   * the legacy one-shot path).
   */
  private buildCrossModelPrompt(job: ReviewJob, prompt: string): string {
    const prId = job.pullRequest.id;
    const prRepo = job.pullRequest.repository;
    const myModel = normalizeSelectableModelId(job.modelName);

    // Collect completed jobs for the same PR from the in-memory queue
    const completedSiblings = this.jobs.filter(
      (j) =>
        j.id !== job.id &&
        j.pullRequest.id === prId &&
        j.pullRequest.repository === prRepo &&
        (j.taskType ?? inferTaskType(j.prompt)) === (job.taskType ?? inferTaskType(job.prompt)) &&
        j.status === 'Completed' &&
        j.reviewResponse &&
        normalizeSelectableModelId(j.modelName) !== myModel // Only other models
    );

    if (completedSiblings.length === 0) {
      return this.withReviewExecutionContext(job, prompt);
    }

    const findingsBlocks: string[] = [];
    for (const sibling of completedSiblings) {
      const summary = buildFindingsSummary(sibling);
      if (summary) {
        findingsBlocks.push(`-- Model: ${normalizeSelectableModelId(sibling.modelName)} --\n${summary}`);
      }
    }

    if (findingsBlocks.length === 0) {
      return this.withReviewExecutionContext(job, prompt);
    }

    const crossModelContext = [
      '=== PRIOR REVIEW FINDINGS FROM OTHER MODELS ===',
      'The following issues were found by other AI reviewers on this same PR.',
      'Consider them when writing your review — confirm valid findings,',
      'challenge incorrect ones, and focus on issues not yet covered.',
      '',
      ...findingsBlocks,
      '',
      '=== END OF PRIOR FINDINGS ==='
    ].join('\n');

    return this.withReviewExecutionContext(job, `${crossModelContext}\n\n${prompt}`);
  }

  private resolveSummaryContext(reviewSessionOptions?: ReviewSessionOptions | null): ResolvedReviewContext {
    const normalized = normalizeReviewSessionOptions(reviewSessionOptions);
    return {
      requestedContextMode: normalized?.requestedContextMode ?? 'diff-only',
      effectiveContextMode: 'diff-only',
      reviewSessionOptions: undefined,
      fallbackReason: null
    };
  }

  private async resolveReviewContext(job: ReviewJob, debugLog: (message: string) => void): Promise<ResolvedReviewContext> {
    const normalized = normalizeReviewSessionOptions(job.reviewSessionOptions);
    const requestedContextMode = normalized?.requestedContextMode
      ?? (normalized?.workingDirectory ? 'branch-aware' : 'diff-only');

    if (requestedContextMode !== 'branch-aware') {
      return {
        requestedContextMode,
        effectiveContextMode: normalized?.workingDirectory ? 'branch-aware' : 'diff-only',
        reviewSessionOptions: normalized,
        fallbackReason: null
      };
    }

    const currentStatus = this.reviewWorktreeService?.getStatus(job.pullRequest);
    if (currentStatus?.state === 'blocked') {
      throw new Error(currentStatus.statusMessage.trim() || 'Branch-aware review requires a configured review worktree root folder.');
    }

    if (normalized?.workingDirectory) {
      return {
        requestedContextMode,
        effectiveContextMode: 'branch-aware',
        reviewSessionOptions: normalized,
        fallbackReason: null
      };
    }

    if (!this.reviewWorktreeService) {
      return {
        requestedContextMode,
        effectiveContextMode: 'diff-only',
        reviewSessionOptions: { requestedContextMode },
        fallbackReason: 'Branch context preparation service is unavailable.'
      };
    }

    this.setActivePhase(job, 'Preparing branch context...');
    this.setProgress(job, 15);
    debugLog(`Preparing branch context for PR #${job.pullRequest.id}`);
    const status = await this.reviewWorktreeService.preloadForPullRequest(job.pullRequest);
    const statusWorkingDirectory = status?.workingDirectory?.trim();
    if (status?.state === 'blocked') {
      const message = status.statusMessage.trim() || 'Branch-aware review requires a configured review worktree root folder.';
      debugLog(`Branch context blocked: ${message}`);
      throw new Error(message);
    }
    if (status?.state === 'ready' && statusWorkingDirectory) {
      this.setProgress(job, 20);
      debugLog(`Branch context ready: ${statusWorkingDirectory}`);
      return {
        requestedContextMode,
        effectiveContextMode: 'branch-aware',
        reviewSessionOptions: normalizeReviewSessionOptions({
          requestedContextMode,
          workingDirectory: statusWorkingDirectory
        }),
        fallbackReason: null
      };
    }

    debugLog(`Branch context unavailable; falling back to diff-only: ${buildFallbackReason(status)}`);
    return {
      requestedContextMode,
      effectiveContextMode: 'diff-only',
      reviewSessionOptions: { requestedContextMode },
      fallbackReason: buildFallbackReason(status)
    };
  }

  private withReviewExecutionContext(job: ReviewJob, prompt: string): string {
    const requestedContextMode = normalizeReviewContextMode(job.reviewSessionOptions?.requestedContextMode)
      ?? (job.reviewSessionOptions?.workingDirectory ? 'branch-aware' : 'diff-only');

    if (job.effectiveContextMode === 'branch-aware') {
      const contextBlock = [
        '=== REVIEW EXECUTION CONTEXT ===',
        'Mode: branch-aware',
        'Start by inspecting the PR change boundary from the review worktree using the provided local comparison command.',
        'Treat that local PR delta as the required first step, then walk outward only through causally affected code paths.',
        'You may inspect the checked-out repository workspace read-only to understand integration impact, nearby callers, related types, and regression risk.',
        'Keep the review focused on this pull request. Do not turn it into a whole-repository audit.',
        'Only inspect extra repository context when it materially helps validate the PR impact.',
        '=== END REVIEW EXECUTION CONTEXT ===',
        ''
      ].join('\n');
      return `${contextBlock}\n${prompt}`;
    }

    if (requestedContextMode === 'branch-aware' && job.fallbackReason) {
      const contextBlock = [
        '=== REVIEW EXECUTION CONTEXT ===',
        'Requested mode: branch-aware',
        'Applied mode: diff-only fallback',
        `Fallback reason: ${job.fallbackReason}`,
        'Do not assume a prepared repository checkout is available for this run.',
        'Review only the provided diff, prompt context, and quoted snippets.',
        '=== END REVIEW EXECUTION CONTEXT ===',
        ''
      ].join('\n');
      return `${contextBlock}\n${prompt}`;
    }

    return prompt;
  }

  private async buildReviewPrompts(job: ReviewJob, debugLog: (message: string) => void): Promise<{ prompts: string[]; changedFileCount: number }> {
    if (job.effectiveContextMode === 'branch-aware') {
      const boundary = job.reviewPromptContext?.prChangeBoundary;
      if (!boundary) {
        throw new Error('PR change boundary is missing for the branch-aware review.');
      }
      job.batchLabel = null;
      job.batchPrompts = null;
      return {
        prompts: [`${job.prompt}\n\n${buildPrChangeBoundaryBlock(boundary)}`],
        changedFileCount: boundary.changedFiles.length
      };
    }

    const promptData = await this.buildDiffReviewPrompts(job, debugLog);
    job.batchLabel = promptData.prompts.length > 1
      ? `${promptData.prompts.length} batches (${promptData.changedFileCount} files)`
      : null;
    job.batchPrompts = promptData.prompts.length > 1 ? promptData.prompts.slice(1) : null;
    return promptData;
  }

  private async buildDiffReviewPrompts(job: ReviewJob, debugLog: (message: string) => void): Promise<{ prompts: string[]; changedFileCount: number }> {
    if (!this.pullRequestChangesService) {
      throw new Error('Pull request diff service is unavailable.');
    }

    this.setActivePhase(job, 'Loading PR diff...');
    debugLog(`Loading diff payload for PR #${job.pullRequest.id}`);
    const allDiffs = await this.pullRequestChangesService.getPullRequestFileDiffs(job.pullRequest.id);
    const changedFiles = job.reviewPromptContext?.changedFiles;
    const includedPaths = new Set(
      (changedFiles ?? [])
        .map((fileChange) => fileChange.path?.trim())
        .filter((path): path is string => Boolean(path))
    );
    const diffs = changedFiles
      ? allDiffs.filter((diff) => includedPaths.has(diff.path))
      : allDiffs;
    const changedFileCount = diffs.length;
    if (diffs.length === 0) {
      return { prompts: [job.prompt], changedFileCount };
    }

    const fullDiffText = buildDiffText(diffs);
    if (fullDiffText.length <= MAX_DIFF_CHARS_PER_BATCH) {
      return {
        prompts: [`${job.prompt}\n\n${fullDiffText}`],
        changedFileCount
      };
    }

    const batches = chunkDiffs(diffs, MAX_DIFF_CHARS_PER_BATCH);
    const totalBatches = batches.length;
    return {
      prompts: batches.map((batch, index) => `[Batch ${index + 1}/${totalBatches} — ${batch.length} files]\n\n${job.prompt}\n\n${buildDiffText(batch)}`),
      changedFileCount
    };
  }
}

const truncateFileDiff = (diff: PullRequestFileDiff, limit: number): PullRequestFileDiff => {
  const headerSize = `File: ${diff.path}\n`.length + 2;
  const available = Math.max(limit - headerSize - 200, 1000);
  if (diff.diffText.length <= available) return diff;
  const truncated = diff.diffText.slice(0, available);
  return {
    ...diff,
    diffText: `${truncated}\n\n[... truncated — file too large (${diff.diffText.length} chars, kept first ${available}) ...]`
  };
};

const chunkDiffs = (diffs: PullRequestFileDiff[], maxChars: number): PullRequestFileDiff[][] => {
  if (diffs.length === 0) return [];

  const entries = diffs.map((diff) => {
    const safe = truncateFileDiff(diff, MAX_SINGLE_FILE_CHARS);
    const size = `File: ${safe.path}\n${safe.diffText}`.length + 2;
    return { diff: safe, size };
  });
  entries.sort((a, b) => b.size - a.size);

  const batches: { items: PullRequestFileDiff[]; size: number }[] = [];
  for (const entry of entries) {
    let placed = false;
    for (const batch of batches) {
      if (batch.size + entry.size <= maxChars) {
        batch.items.push(entry.diff);
        batch.size += entry.size;
        placed = true;
        break;
      }
    }
    if (!placed) {
      batches.push({ items: [entry.diff], size: entry.size });
    }
  }

  return batches.map((batch) => batch.items);
};

const buildDiffText = (diffs: PullRequestFileDiff[]): string =>
  diffs.map((diff) => `File: ${diff.path}\n${diff.diffText}`).join('\n\n');

const inferTaskType = (prompt: string): 'Code review' | 'Changes summary' => {
  if (prompt.includes('[TASK_TYPE:WORK_ITEMS_SUMMARY]')) {
    return 'Changes summary';
  }
  return 'Code review';
};

const normalizeReviewSessionOptions = (options?: ReviewSessionOptions | null): ReviewSessionOptions | undefined => {
  const requestedContextMode = normalizeReviewContextMode(options?.requestedContextMode);
  const workingDirectory = options?.workingDirectory?.trim();
  if (!workingDirectory) {
    return requestedContextMode ? { requestedContextMode } : undefined;
  }
  if (!isAbsolute(workingDirectory)) {
    throw new Error('Repository workspace path must be an absolute path.');
  }
  const resolvedPath = resolve(workingDirectory);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Repository workspace path does not exist: ${resolvedPath}`);
  }
  if (!statSync(resolvedPath).isDirectory()) {
    throw new Error(`Repository workspace path must point to a directory: ${resolvedPath}`);
  }
  return {
    requestedContextMode,
    workingDirectory: resolvedPath
  };
};

const buildReviewSessionOptionsKey = (options?: ReviewSessionOptions | null): string => {
  const requestedContextMode = normalizeReviewContextMode(options?.requestedContextMode)
    ?? (options?.workingDirectory?.trim() ? 'branch-aware' : 'diff-only');
  const workingDirectory = options?.workingDirectory?.trim();
  if (!workingDirectory) {
    return requestedContextMode;
  }
  const resolvedPath = resolve(workingDirectory);
  const normalizedPath = process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
  return `${requestedContextMode}:${normalizedPath}`;
};

const normalizeReviewContextMode = (value?: string | null): ReviewContextMode | undefined => {
  if (value === 'branch-aware' || value === 'diff-only') {
    return value;
  }
  return undefined;
};

const buildFallbackReason = (status?: { state: string; statusMessage: string; errorMessage?: string | null } | null): string => {
  if (!status) {
    return 'Prepared branch context is unavailable.';
  }
  return status.errorMessage?.trim() || status.statusMessage.trim() || 'Prepared branch context is unavailable.';
};

interface ResolvedReviewContext {
  requestedContextMode: ReviewContextMode;
  effectiveContextMode: ReviewContextMode;
  reviewSessionOptions?: ReviewSessionOptions;
  fallbackReason?: string | null;
}
