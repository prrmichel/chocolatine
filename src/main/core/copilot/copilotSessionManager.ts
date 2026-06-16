import { approveAll, CopilotClient } from '@github/copilot-sdk';
import type { CopilotSession } from '@github/copilot-sdk';
import { resolve } from 'path';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { buildCopilotClientOptions } from '@main/utils/copilotClientOptions';
import { AUTO_MODEL_ID, normalizeSelectableModelId, toSdkModel } from '@shared/constants/modelOptions';
import { COPILOT_TIMEOUT_MS } from '@shared/constants/timeouts';
import type { ModelInfo, ReviewSessionOptions } from '@shared/types/models';

const COPILOT_CLIENT_NAME = 'Chocolatine';

/** Maximum number of in-memory sessions. Oldest unused sessions are evicted beyond this limit. */
const MAX_IN_MEMORY_SESSIONS = 20;

/**
 * Manages a singleton CopilotClient and persistent sessions keyed by context.
 *
 * Session keys follow these conventions:
 * - PR reviews:  `"review:{prRepo}:{prId}:{modelName}"`  (one session per PR+model)
 * - Ask chat:    `"ask:{contextId}"`
 * - Follow-up:   `"followup:{contextId}"`
 *
 * Sessions are persisted to disk by the SDK (infinite sessions, enabled by default)
 * and can be resumed across app restarts via `resumeSession()`.
 * The mapping from context key → SDK session ID is stored in SQLite.
 */
export class CopilotSessionManager {
  private client: CopilotClient | null = null;
  private clientPromise: Promise<void> | null = null;
  private readonly sessions = new Map<string, CopilotSession>();
  private readonly sessionModels = new Map<string, string>();
  /** Tracks when each in-memory session was last used, for LRU eviction. */
  private readonly sessionLastUsed = new Map<string, number>();
  /** Tracks the skill directories a session was created with (sorted, joined key). */
  private readonly sessionSkillKeys = new Map<string, string>();
  /** Tracks the working directory bound to each in-memory session. */
  private readonly sessionWorkspaceKeys = new Map<string, string>();

  /**
   * Per-key lock to prevent concurrent getOrCreateSession calls from
   * creating duplicate sessions for the same key.
   */
  private readonly pendingCreations = new Map<string, Promise<CopilotSession>>();

  /** Subscribers that receive SDK debug log lines in real-time. */
  private logListeners: Array<(line: string) => void> = [];
  /** Original process.stderr.write, saved so the hook can be removed. */
  private originalStderrWrite: typeof process.stderr.write | null = null;

  constructor(private readonly database: DatabaseService) {
    this.installStderrHook();
  }

  /** Register a callback that receives every SDK debug log line. */
  onLog(listener: (line: string) => void): () => void {
    this.logListeners.push(listener);
    return () => {
      this.logListeners = this.logListeners.filter((l) => l !== listener);
    };
  }

  /** Intercept process.stderr to capture SDK log lines during execution. */
  private installStderrHook(): void {
    const original = process.stderr.write.bind(process.stderr);
    this.originalStderrWrite = process.stderr.write;

    process.stderr.write = ((
      chunk: Uint8Array | string,
      encodingOrCb?: BufferEncoding | ((err?: Error) => void),
      cb?: (err?: Error) => void
    ): boolean => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      // Forward all stderr lines to listeners while a job is running.
      // This captures SDK subprocess logs, reasoning traces, progress, etc.
      if (this.logListeners.length > 0) {
        const lines = text.split('\n').filter((l) => l.trim());
        for (const line of lines) {
          for (const listener of this.logListeners) {
            try { listener(line); } catch { /* ignore */ }
          }
        }
      }
      return original(chunk, encodingOrCb as BufferEncoding, cb);
    }) as typeof process.stderr.write;
  }

  /**
   * Format a session event into a human-readable log line.
   * Based on: https://github.com/github/copilot-sdk/blob/main/docs/features/streaming-events.md
   * Returns null only for events already handled by dedicated subscriptions.
   */
  private formatSessionEvent(event: any): string | null {
    if (!event || !event.type) return null;

    const type: string = event.type;
    const data = event.data ?? {};

    // Skip streaming_delta (noisy byte counts)
    if (type === 'assistant.streaming_delta') return null;

    switch (type) {
      case 'session.start':
        return `[Session] Started${this.formatContextSuffix(data.context)}`;

      case 'session.resume':
        return `[Session] Resumed${this.formatContextSuffix(data.context)}`;

      // ── Assistant Events ──────────────────────────────────────────
      case 'assistant.turn_start':
        return `[Turn Start] Turn ${data.turnId ?? '?'}${data.interactionId ? ` (interaction: ${data.interactionId})` : ''}`;

      case 'assistant.intent':
        return `[Intent] ${data.intent ?? ''}`;

      case 'assistant.reasoning':
        return `[Reasoning] ${data.content ?? ''}`;

      case 'assistant.reasoning_delta':
        // Handled by accumulation buffer in sendMessageOnce
        return null;

      case 'assistant.message_delta':
        // Handled by accumulation buffer in sendMessageOnce
        return null;

      case 'assistant.message': {
        const toolReqs = data.toolRequests;
        const toolSummary = Array.isArray(toolReqs) && toolReqs.length > 0
          ? ` | tools: ${toolReqs.map((t: any) => t.name ?? t.toolCallId).join(', ')}`
          : '';
        const phase = data.phase ? ` (phase: ${data.phase})` : '';
        const tokens = data.outputTokens ? ` [${data.outputTokens} tokens]` : '';
        const content = data.content ?? '';
        const contentLine = content ? `\n${content}` : '';
        // Include reasoningText if present (some models embed it in the message event)
        const reasoning = data.reasoningText ?? '';
        const reasoningLine = reasoning ? `\n[Message Reasoning] ${reasoning}` : '';
        return `[Message] ${content.length} chars${phase}${tokens}${toolSummary}${reasoningLine}${contentLine}`;
      }

      case 'assistant.turn_end':
        return `[Turn End] Turn ${data.turnId ?? '?'}`;

      case 'assistant.usage': {
        const parts: string[] = [];
        if (data.model) parts.push(`model: ${data.model}`);
        if (data.inputTokens != null) parts.push(`in: ${data.inputTokens}`);
        if (data.outputTokens != null) parts.push(`out: ${data.outputTokens}`);
        if (data.cacheReadTokens != null) parts.push(`cache-read: ${data.cacheReadTokens}`);
        if (data.cacheWriteTokens != null) parts.push(`cache-write: ${data.cacheWriteTokens}`);
        if (data.cost != null) parts.push(`cost: ${data.cost}`);
        if (data.duration != null) parts.push(`${data.duration}ms`);
        return `[Usage] ${parts.join(' | ')}`;
      }

      // ── Tool Execution Events ─────────────────────────────────────
      case 'tool.user_requested':
        return `[Tool Requested] ${data.toolName ?? '?'}(${this.summarizeArgs(data.arguments)})`;

      case 'tool.execution_start': {
        const mcp = data.mcpServerName ? ` [MCP: ${data.mcpServerName}/${data.mcpToolName}]` : '';
        return `[Tool Start] ${data.toolName ?? '?'}(${this.summarizeArgs(data.arguments)})${mcp}`;
      }

      case 'tool.execution_partial_result':
        return `[Tool Output] ${(data.partialOutput ?? '').slice(0, 300)}`;

      case 'tool.execution_progress':
        return `[Tool Progress] ${data.progressMessage ?? ''}`;

      case 'tool.execution_complete': {
        const status = data.success ? '✓ success' : `✗ failed`;
        const err = data.error?.message ? ` — ${data.error.message}` : '';
        const resultLen = data.result?.content ? ` (${data.result.content.length} chars)` : '';
        return `[Tool Complete] ${status}${resultLen}${err}`;
      }

      // ── Session Lifecycle Events ──────────────────────────────────
      case 'session.idle':
        return `[Session] Idle`;

      case 'session.error':
        return `[Error] ${data.errorType ?? 'unknown'}: ${data.message ?? ''}${data.statusCode ? ` (HTTP ${data.statusCode})` : ''}`;

      case 'session.compaction_start':
        return `[Compaction] Starting context compaction...`;

      case 'session.compaction_complete': {
        const result = data.success ? 'success' : `failed: ${data.error ?? ''}`;
        const tokens = data.preCompactionTokens ? ` (${data.preCompactionTokens} → ${data.postCompactionTokens} tokens)` : '';
        return `[Compaction] ${result}${tokens}`;
      }

      case 'session.title_changed':
        return `[Session] Title: ${data.title ?? ''}`;

      case 'session.context_changed':
        return `[Context]${this.formatContextSuffix(data)}`;

      case 'session.usage_info':
        return `[Context Window] ${data.currentTokens ?? '?'}/${data.tokenLimit ?? '?'} tokens, ${data.messagesLength ?? '?'} messages`;

      case 'session.task_complete':
        return `[Task Complete] ${data.summary ?? ''}`;

      case 'session.shutdown': {
        const reason = data.shutdownType === 'error' ? ` — ${data.errorReason ?? 'unknown error'}` : '';
        return `[Session Shutdown] ${data.shutdownType ?? ''}${reason} | ${data.totalPremiumRequests ?? 0} requests, ${data.totalApiDurationMs ?? 0}ms total`;
      }

      case 'session.model_change':
        return `[Model] Changed to ${data.model ?? data.modelId ?? JSON.stringify(data).slice(0, 100)}`;

      case 'session.plan_changed':
        return `[Plan] ${JSON.stringify(data).slice(0, 300)}`;

      case 'session.info':
        return `[Info] ${data.message ?? JSON.stringify(data).slice(0, 200)}`;

      case 'session.warning':
        return `[Warning] ${data.message ?? JSON.stringify(data).slice(0, 200)}`;

      // ── Permission & User Input Events ────────────────────────────
      case 'permission.requested': {
        const perm = data.permissionRequest;
        const kind = perm?.kind ?? '?';
        const detail = perm?.intention ?? perm?.toolName ?? perm?.fileName ?? perm?.fullCommandText ?? '';
        return `[Permission] Requested: ${kind}${detail ? ` — ${String(detail).slice(0, 150)}` : ''}`;
      }

      case 'permission.completed': {
        const resultKind = data.result?.kind ?? '?';
        return `[Permission] ${resultKind}`;
      }

      case 'user_input.requested':
        return `[User Input] Question: ${data.question ?? ''}${data.choices ? ` [${data.choices.join(', ')}]` : ''}`;

      case 'user_input.completed':
        return `[User Input] Completed`;

      case 'elicitation.requested':
        return `[Elicitation] ${data.message ?? ''}`;

      case 'elicitation.completed':
        return `[Elicitation] Completed`;

      // ── Sub-Agent & Skill Events ──────────────────────────────────
      case 'subagent.started':
        return `[SubAgent] Started: ${data.agentDisplayName ?? data.agentName ?? ''}`;

      case 'subagent.completed':
        return `[SubAgent] Completed: ${data.agentDisplayName ?? data.agentName ?? ''}`;

      case 'subagent.failed':
        return `[SubAgent] Failed: ${data.agentDisplayName ?? data.agentName ?? ''} — ${data.error ?? ''}`;

      case 'subagent.selected':
        return `[SubAgent] Selected: ${data.agentDisplayName ?? data.agentName ?? ''}${data.tools ? ` (tools: ${data.tools.join(', ')})` : ''}`;

      case 'subagent.deselected':
        return `[SubAgent] Deselected`;

      case 'skill.invoked': {
        const skillContent = data.content ?? '';
        const contentInfo = skillContent ? `\n${skillContent}` : '';
        return `[Skill] ${data.name ?? '?'} (${data.path ?? ''})${data.allowedTools ? ` [tools: ${data.allowedTools.join(', ')}]` : ''}${contentInfo}`;
      }

      // ── Other Events ──────────────────────────────────────────────
      case 'abort':
        return `[Abort] ${data.reason ?? ''}`;

      case 'user.message': {
        const content = data.content ?? '';
        const preview = content.length > 200 ? content.slice(0, 197) + '...' : content;
        return `[User Message] ${preview}${data.agentMode ? ` (mode: ${data.agentMode})` : ''}`;
      }

      case 'system.message':
        return `[System] ${data.role ?? ''}: ${(data.content ?? '').slice(0, 200)}${data.name ? ` (${data.name})` : ''}`;

      case 'external_tool.requested':
        return `[External Tool] Requested: ${data.toolName ?? '?'}(${this.summarizeArgs(data.arguments)})`;

      case 'external_tool.completed':
        return `[External Tool] Completed`;

      case 'exit_plan_mode.requested':
        return `[Plan Mode] Exit requested — ${data.summary ?? ''} (recommended: ${data.recommendedAction ?? '?'})`;

      case 'exit_plan_mode.completed':
        return `[Plan Mode] Exit completed`;

      case 'command.queued':
        return `[Command] Queued: ${data.command ?? ''}`;

      case 'command.execute':
        return `[Command] Executing: ${JSON.stringify(data).slice(0, 200)}`;

      case 'command.completed':
        return `[Command] Completed`;

      case 'commands.changed':
        return `[Commands] Changed: ${JSON.stringify(data).slice(0, 200)}`;

      // ── Session infrastructure events ─────────────────────────────
      case 'session.mode_changed':
        return `[Session] Mode changed: ${JSON.stringify(data).slice(0, 150)}`;

      case 'session.truncation':
        return `[Session] Truncation: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.snapshot_rewind':
        return `[Session] Snapshot rewind: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.workspace_file_changed':
        return `[Session] Workspace file changed: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.handoff':
        return `[Session] Handoff: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.tools_updated':
        return `[Session] Tools updated`;

      case 'session.background_tasks_changed':
        return `[Session] Background tasks changed`;

      case 'session.skills_loaded':
        return `[Skills Loaded] ${Array.isArray(data.skills) ? data.skills.map((s: any) => s.name ?? s).join(', ') : JSON.stringify(data).slice(0, 200)}`;

      case 'session.mcp_servers_loaded':
        return `[MCP] Servers loaded: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.mcp_server_status_changed':
        return `[MCP] Server status: ${JSON.stringify(data).slice(0, 200)}`;

      case 'session.extensions_loaded':
        return `[Extensions] Loaded: ${JSON.stringify(data).slice(0, 200)}`;

      case 'pending_messages.modified':
        return `[Session] Pending messages modified`;

      case 'mcp.oauth_required':
        return `[MCP] OAuth required: ${JSON.stringify(data).slice(0, 200)}`;

      case 'mcp.oauth_completed':
        return `[MCP] OAuth completed`;

      default:
        return `[${type}] ${JSON.stringify(data).slice(0, 300)}`;
    }
  }

  private formatContextSuffix(context: any): string {
    if (!context) {
      return '';
    }

    const parts: string[] = [];
    if (context.cwd) parts.push(`cwd: ${context.cwd}`);
    if (context.gitRoot) parts.push(`gitRoot: ${context.gitRoot}`);
    if (context.repository) parts.push(`repo: ${context.repository}`);
    if (context.branch) parts.push(`branch: ${context.branch}`);
    if (context.baseCommit) parts.push(`base: ${context.baseCommit}`);
    if (context.headCommit) parts.push(`head: ${context.headCommit}`);
    return parts.length > 0 ? ` | ${parts.join(' | ')}` : '';
  }

  private summarizeArgs(args: any): string {
    if (!args) return '';
    const entries = Object.entries(args);
    if (entries.length === 0) return '';
    return entries
      .map(([k, v]) => {
        const val = typeof v === 'string' ? (v.length > 60 ? v.slice(0, 57) + '...' : v) : JSON.stringify(v);
        return `${k}=${val}`;
      })
      .join(', ')
      .slice(0, 200);
  }

  // ─── Public API ─────────────────────────────────────────────────

  /**
   * List available models from the Copilot SDK.
   * Results are cached by the SDK client after the first successful call.
   */
  async listModels(traceId?: string): Promise<ModelInfo[]> {
    const resolvedTraceId = traceId?.trim() || 'none';
    try {
      const client = await this.getClient();
      const models = await client.listModels();
      const filtered = models
        .filter((m: any) => m.policy?.state !== 'disabled')
        .map((m: any) => ({
          ...m,
          id: m.id ?? '',
          name: m.name ?? m.id ?? ''
        }))
        .filter((m: { id: string }) => m.id.length > 0) as ModelInfo[];
      return filtered;
    } catch (err) {
      console.warn(`[CopilotSession] listModels() failed (traceId=${resolvedTraceId}):`, err instanceof Error ? err.message : String(err));
      return [];
    }
  }

  /**
   * Send a message to an existing or new session identified by `key`.
   * The session is created/resumed lazily on first use.
   *
   * If the first attempt times out (likely a stale session), the broken
   * session is destroyed and the call is retried once with a fresh session.
   */
  async sendMessage(
    key: string,
    prompt: string,
    modelName?: string | null,
    options?: {
      onDelta?: (delta: string, fullText: string) => void;
      onModelUsed?: (modelName: string) => void;
      onUsage?: (payload: unknown) => void;
      signal?: AbortSignal;
      timeoutMs?: number;
      skillDirectories?: string[];
      disabledSkills?: string[];
      reviewSessionOptions?: ReviewSessionOptions;
    }
  ): Promise<string> {
    if (!prompt.trim()) {
      throw new Error('Prompt is empty.');
    }

    const normalizedKey = this.normalizeContextKey(key, modelName);
    const requestedModel = normalizeSelectableModelId(modelName);

    try {
      return await this.sendMessageOnce(normalizedKey, requestedModel, prompt, options);
    } catch (error: unknown) {
      // If the caller already aborted, don't retry.
      if (options?.signal?.aborted) throw error;

      const message = error instanceof Error ? error.message : String(error ?? '');
      const isRetryable =
        message.includes('timed out') ||
        message.includes('Timeout') ||
        message.includes('empty response') ||
        this.isSessionNotFoundError(error);

      if (isRetryable) {
        // Stale or broken session — destroy it and retry once with a fresh session.
        console.warn(`[CopilotSession] Retryable error for "${normalizedKey}": ${message}. Destroying session and retrying.`);
        await this.destroyAndCleanSession(normalizedKey);
        return this.sendMessageOnce(normalizedKey, requestedModel, prompt, options);
      }

      throw error;
    }
  }

  // ── Internal: single-attempt send ────────────────────────────────
  private async sendMessageOnce(
    normalizedKey: string,
    requestedModel: string,
    prompt: string,
    options?: {
      onDelta?: (delta: string, fullText: string) => void;
      onModelUsed?: (modelName: string) => void;
      onUsage?: (payload: unknown) => void;
      signal?: AbortSignal;
      timeoutMs?: number;
      skillDirectories?: string[];
      disabledSkills?: string[];
      reviewSessionOptions?: ReviewSessionOptions;
    }
  ): Promise<string> {
    const session = await this.getOrCreateSession(
      normalizedKey,
      requestedModel,
      options?.skillDirectories,
      options?.disabledSkills,
      options?.reviewSessionOptions
    );
    const timeoutMs = options?.timeoutMs ?? COPILOT_TIMEOUT_MS;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
    const signal = options?.signal
      ? anySignal([options.signal, timeoutController.signal])
      : timeoutController.signal;

    const abortListener = () => {
      Promise.race([
        session.abort(),
        new Promise((resolve) => setTimeout(resolve, 5_000))
      ]).catch(() => {});
    };
    signal.addEventListener('abort', abortListener, { once: true });

    let fullText = '';
    let unsubscribeDelta: (() => void) | null = null;
    let unsubscribeUsage: (() => void) | null = null;
    let unsubscribeAllEvents: (() => void) | null = null;

    if (options?.onDelta) {
      const onDelta = options.onDelta;
      unsubscribeDelta = session.on('assistant.message_delta', (event) => {
        if (event?.agentId) return;
        const delta = event?.data?.deltaContent ?? '';
        if (!delta) return;
        fullText += delta;
        onDelta(delta, fullText);
      });
    }

    if (options?.onModelUsed) {
      const onModelUsed = options.onModelUsed;
      unsubscribeUsage = session.on('assistant.usage', (event) => {
        const actualModel = event?.data?.model;
        if (actualModel) {
          onModelUsed(actualModel);
        }
        options.onUsage?.(event?.data);
      });
    } else if (options?.onUsage) {
      unsubscribeUsage = session.on('assistant.usage', (event) => {
        options.onUsage?.(event?.data);
      });
    }

    // ── Delta accumulation for readable debug logs ─────────────
    // Instead of emitting one log line per streaming token (unreadable),
    // accumulate deltas in buffers and flush every DELTA_FLUSH_MS as a
    // single cohesive log entry.
    const DELTA_FLUSH_MS = 500;
    let responseBuf = '';
    let responseTimer: ReturnType<typeof setTimeout> | null = null;
    let thinkingBuf = '';
    let thinkingTimer: ReturnType<typeof setTimeout> | null = null;
    let hadResponseDeltas = false;
    let hadReasoningDeltas = false;

    const emitLog = (line: string): void => {
      for (const listener of this.logListeners) {
        try { listener(line); } catch { /* ignore */ }
      }
    };

    const flushResponse = (): void => {
      if (responseBuf) {
        emitLog(`[Response] ${responseBuf}`);
        responseBuf = '';
      }
      responseTimer = null;
    };

    const flushThinking = (): void => {
      if (thinkingBuf) {
        emitLog(`[Thinking] ${thinkingBuf}`);
        thinkingBuf = '';
      }
      thinkingTimer = null;
    };

    // Subscribe to all session events to forward traces to log listeners
    unsubscribeAllEvents = session.on((event: any) => {
      if (this.logListeners.length === 0) return;

      const evtType = event?.type;
      const evtData = event?.data ?? {};

      // Accumulate message deltas
      if (evtType === 'assistant.message_delta') {
        if (event?.agentId) {
          return;
        }
        const delta = evtData.deltaContent;
        if (delta) {
          hadResponseDeltas = true;
          responseBuf += delta;
          if (!responseTimer) {
            responseTimer = setTimeout(flushResponse, DELTA_FLUSH_MS);
          }
        }
        return;
      }

      // Accumulate reasoning deltas
      if (evtType === 'assistant.reasoning_delta') {
        if (event?.agentId) {
          return;
        }
        const delta = evtData.deltaContent;
        if (delta) {
          hadReasoningDeltas = true;
          thinkingBuf += delta;
          if (!thinkingTimer) {
            thinkingTimer = setTimeout(flushThinking, DELTA_FLUSH_MS);
          }
        }
        return;
      }

      // When complete message arrives, flush buffer then show metadata
      if (evtType === 'assistant.message') {
        if (responseTimer) { clearTimeout(responseTimer); responseTimer = null; }
        flushResponse();
        if (hadResponseDeltas) {
          // Content was already streamed via [Response] entries — emit metadata only
          const toolReqs = evtData.toolRequests;
          const toolSummary = Array.isArray(toolReqs) && toolReqs.length > 0
            ? ` | tools: ${toolReqs.map((t: any) => t.name ?? t.toolCallId).join(', ')}`
            : '';
          const phase = evtData.phase ? ` (phase: ${evtData.phase})` : '';
          const tokens = evtData.outputTokens ? ` [${evtData.outputTokens} tokens]` : '';
          const reasoning = evtData.reasoningText ?? '';
          const reasoningLine = reasoning ? `\n[Message Reasoning] ${reasoning}` : '';
          emitLog(`[Message Complete] ${(evtData.content ?? '').length} chars${phase}${tokens}${toolSummary}${reasoningLine}`);
          hadResponseDeltas = false;
          return;
        }
        // No deltas received (non-streaming) — fall through to formatSessionEvent
      }

      // When complete reasoning arrives, flush buffer then show summary
      if (evtType === 'assistant.reasoning') {
        if (thinkingTimer) { clearTimeout(thinkingTimer); thinkingTimer = null; }
        flushThinking();
        if (hadReasoningDeltas) {
          // Content was already streamed via [Thinking] entries — emit summary only
          emitLog(`[Reasoning Complete] ${(evtData.content ?? '').length} chars`);
          hadReasoningDeltas = false;
          return;
        }
        // No deltas received — fall through to formatSessionEvent
      }

      const line = this.formatSessionEvent(event);
      if (line) {
        emitLog(line);
      }
    });

    const startTime = Date.now();
    try {
      // Race sendAndWait against the abort signal so the promise is cut
      // immediately when the timeout fires, rather than waiting for the
      // SDK's internal timeout (which only starts AFTER send() completes).
      const abortPromise = new Promise<never>((_, reject) => {
        if (signal.aborted) {
          reject(new Error('Copilot request timed out.'));
          return;
        }
        signal.addEventListener('abort', () => reject(new Error('Copilot request timed out.')), { once: true });
      });

      // Give SDK a longer internal timeout as safety net; the app's abort
      // should always fire first.
      const sendPromise = session.sendAndWait({ prompt }, timeoutMs + 30_000);
      // Suppress unhandled rejection if the abort race wins first.
      sendPromise.catch(() => {});

      const response = await Promise.race([sendPromise, abortPromise]);

      if (!fullText) {
        fullText = response?.data?.content ?? '';
      }

      const elapsed = Date.now() - startTime;
      if (!fullText.trim()) {
        console.warn(`[CopilotSession] Empty response from "${normalizedKey}" after ${elapsed}ms`);
        throw new Error('Copilot returned an empty response.');
      }

      // Update last_used timestamp
      this.database.touchCopilotSession(normalizedKey);
      this.sessionLastUsed.set(normalizedKey, Date.now());
      return fullText.trim();
    } catch (error: unknown) {
      const elapsed = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error ?? '');
      console.error(`[CopilotSession] Error for "${normalizedKey}" after ${elapsed}ms: ${message}`);

      if (timeoutController.signal.aborted || message.includes('timed out')) {
        throw new Error('Copilot request timed out.');
      }
      // If the session is broken, remove it so the next call creates a fresh one
      await this.handleSessionError(normalizedKey, error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      signal.removeEventListener('abort', abortListener);
      // Flush any remaining accumulated deltas before unsubscribing
      if (responseTimer) { clearTimeout(responseTimer); responseTimer = null; }
      if (thinkingTimer) { clearTimeout(thinkingTimer); thinkingTimer = null; }
      flushResponse();
      flushThinking();
      if (unsubscribeDelta) {
        unsubscribeDelta();
      }
      if (unsubscribeUsage) {
        unsubscribeUsage();
      }
      if (unsubscribeAllEvents) {
        unsubscribeAllEvents();
      }
    }
  }

  /**
   * Destroy a single session (releases in-memory resources, keeps disk data
   * so it can be resumed later).
   */
  async destroySession(key: string): Promise<void> {
    const normalizedKey = this.normalizeContextKey(key);
    const session = this.sessions.get(normalizedKey);
    if (session) {
      try { await session.destroy(); } catch { /* ignore */ }
      this.sessions.delete(normalizedKey);
      this.sessionModels.delete(normalizedKey);
      this.sessionLastUsed.delete(normalizedKey);
      this.sessionSkillKeys.delete(normalizedKey);
      this.sessionWorkspaceKeys.delete(normalizedKey);
    }
  }

  /**
   * Permanently delete a session — removes both in-memory state and disk data.
   * Also removes the DB mapping.
   */
  async deleteSession(key: string): Promise<void> {
    const normalizedKey = this.normalizeContextKey(key);
    const mapping = this.getSessionMapping(normalizedKey);
    const session = this.sessions.get(normalizedKey);

    if (session) {
      try { await session.destroy(); } catch { /* ignore */ }
      this.sessions.delete(normalizedKey);
      this.sessionModels.delete(normalizedKey);
      this.sessionLastUsed.delete(normalizedKey);
      this.sessionSkillKeys.delete(normalizedKey);
      this.sessionWorkspaceKeys.delete(normalizedKey);
    }

    if (mapping) {
      const client = await this.getClient();
      try { await client.deleteSession(mapping.sessionId); } catch { /* ignore */ }
      this.database.deleteCopilotSession(mapping.contextKey);
      if (mapping.contextKey !== normalizedKey) {
        this.database.deleteCopilotSession(normalizedKey);
      }
    }
  }

  /**
   * Delete all sessions for a given pull request (across all models).
   */
  async deleteSessionsForPr(prRepo: string, prId: number): Promise<void> {
    const mappings = this.database.getCopilotSessionsForPr(prId, prRepo);
    for (const mapping of mappings) {
      await this.deleteSession(mapping.contextKey);
    }
  }

  /**
   * Delete all sessions of a given scope (e.g. 'ask', 'followup', 'review').
   */
  async deleteAllSessions(): Promise<void> {
    const allMappings = this.database.getAllCopilotSessions();
    for (const mapping of allMappings) {
      await this.deleteSession(mapping.contextKey);
    }
  }

  /**
   * Graceful shutdown — destroy all in-memory sessions and stop the client.
   * Called on app quit.
   */
  async shutdown(): Promise<void> {
    // Destroy all active sessions (keeps disk data for future resume)
    for (const [key, session] of this.sessions) {
      try { await session.destroy(); } catch { /* ignore */ }
      this.sessions.delete(key);
      this.sessionModels.delete(key);
      this.sessionLastUsed.delete(key);
      this.sessionSkillKeys.delete(key);
      this.sessionWorkspaceKeys.delete(key);
    }
    if (this.client) {
      try { await this.client.stop(); } catch { /* ignore */ }
      this.client = null;
    }
  }

  // ─── Static key builders ────────────────────────────────────────

  /**
   * Session key for PR reviews — one session per PR.
   * Model changes reuse the same session and switch models in-place.
   */
  static reviewKey(prRepo: string, prId: number, modelName?: string | null): string {
    void modelName;
    return `review:${prRepo}:${prId}`;
  }

  static askKey(contextId: string): string {
    return `ask:${contextId}`;
  }

  static followUpKey(contextId: string): string {
    return `followup:${contextId}`;
  }

  /**
   * Check whether a session already exists for this key (in memory or DB).
   */
  hasExistingSession(key: string): boolean {
    const normalizedKey = this.normalizeContextKey(key);
    if (this.sessions.has(normalizedKey)) {
      return true;
    }
    return this.getSessionMapping(normalizedKey) !== null;
  }

  async canResumeSession(key: string, modelName?: string | null): Promise<boolean> {
    const normalizedKey = this.normalizeContextKey(key, modelName);
    if (this.sessions.has(normalizedKey)) {
      return true;
    }

    const requestedModel = normalizeSelectableModelId(modelName);
    const mapping = this.getSessionMapping(normalizedKey, requestedModel);
    if (!mapping) {
      return false;
    }

    const client = await this.getClient();
    let session: CopilotSession | null = null;

    try {
      session = await client.resumeSession(mapping.sessionId, this.buildSessionOptions(requestedModel) as any);
      await this.assertSessionHealthy(session);
      await session.destroy();
      return true;
    } catch (error) {
      console.warn(`[CopilotSession] Resume availability check failed for "${normalizedKey}": ${error instanceof Error ? error.message : String(error)}`);
      this.database.deleteCopilotSession(mapping.contextKey);
      if (mapping.contextKey !== normalizedKey) {
        this.database.deleteCopilotSession(normalizedKey);
      }
      try { await session?.destroy(); } catch { /* ignore */ }
      return false;
    }
  }

  // ─── Private ────────────────────────────────────────────────────


  private async getClient(): Promise<CopilotClient> {
    if (this.client) {
      // SDK 1.x does not expose getState(); if we have no pending start,
      // keep using the existing client instance.
      if (!this.clientPromise) {
        return this.client;
      }
      await this.clientPromise;
      return this.client!;
    }

    // Prevent concurrent client creation
    if (this.clientPromise) {
      await this.clientPromise;
      return this.client!;
    }

    const options = buildCopilotClientOptions();
    const configuredCliPath = options.connection?.kind === 'stdio' ? options.connection.path : undefined;
    this.client = new CopilotClient(options);
    // Explicitly start the client (autoStart only triggers on createSession, not listModels)
    this.clientPromise = this.client.start().catch((err) => {
      const details = err instanceof Error ? err.message : String(err);
      console.warn(`[CopilotSession] Client start failed (platform=${process.platform}-${process.arch}, cliPath=${configuredCliPath ?? 'default'}): ${details}`);
      this.client = null;
      this.clientPromise = null;
      throw err;
    });
    await this.clientPromise;
    return this.client!;
  }

  private async getOrCreateSession(
    key: string,
    modelName?: string | null,
    skillDirectories?: string[],
    disabledSkills?: string[],
    reviewSessionOptions?: ReviewSessionOptions
  ): Promise<CopilotSession> {
    const normalizedKey = this.normalizeContextKey(key, modelName);
    const requestedModel = normalizeSelectableModelId(modelName);

    // 1. Already in memory
    const existing = this.sessions.get(normalizedKey);
    if (existing) {
      // Skills are configured at session creation time — if the requested
      // skills differ from what the session was created with, we must
      // recreate the session so the SDK loads the new SKILL.md files.
      const requestedSkillKey = this.buildSkillKey(skillDirectories);
      const currentSkillKey = this.sessionSkillKeys.get(normalizedKey) ?? '';
      const requestedWorkspaceKey = this.buildWorkspaceKey(reviewSessionOptions);
      const currentWorkspaceKey = this.sessionWorkspaceKeys.get(normalizedKey) ?? '';
      if (requestedSkillKey !== currentSkillKey) {
        await this.deleteSession(normalizedKey);
        return this.getOrCreateSession(normalizedKey, requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
      }
      if (requestedWorkspaceKey !== currentWorkspaceKey) {
        await this.deleteSession(normalizedKey);
        return this.getOrCreateSession(normalizedKey, requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
      }

      const currentModel = this.sessionModels.get(normalizedKey) ?? AUTO_MODEL_ID;
      if (requestedModel === AUTO_MODEL_ID && currentModel !== AUTO_MODEL_ID) {
        await this.deleteSession(normalizedKey);
        return this.getOrCreateSession(normalizedKey, requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
      }
      try {
        await this.ensureSessionModel(existing, normalizedKey, requestedModel);
        return this.sessions.get(normalizedKey) ?? existing;
      } catch (error) {
        if (this.isSessionNotFoundError(error)) {
          console.warn(`[CopilotSession] Session missing for "${normalizedKey}" while switching model. Recreating session.`);
          await this.destroyAndCleanSession(normalizedKey);
          return this.getOrCreateSession(normalizedKey, requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
        }
        throw error;
      }
    }

    // 2. Another call is already creating this session — wait for it
    const pending = this.pendingCreations.get(normalizedKey);
    if (pending) {
      return pending;
    }

    // 3. Create/resume
    const promise = this.createOrResumeSession(normalizedKey, requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
    this.pendingCreations.set(normalizedKey, promise);
    try {
      const session = await promise;
      return session;
    } finally {
      this.pendingCreations.delete(normalizedKey);
    }
  }

  private async createOrResumeSession(
    key: string,
    modelName?: string | null,
    skillDirectories?: string[],
    disabledSkills?: string[],
    reviewSessionOptions?: ReviewSessionOptions
  ): Promise<CopilotSession> {
    // Evict oldest sessions before creating a new one
    await this.evictOldestSessions();

    const client = await this.getClient();
    const normalizedKey = this.normalizeContextKey(key, modelName);
    const requestedModel = normalizeSelectableModelId(modelName);
    const mapping = this.getSessionMapping(normalizedKey, requestedModel);

    // Try to resume an existing session
    if (mapping) {
      try {
        const resumeOptions = this.buildSessionOptions(requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
        const session = await client.resumeSession(mapping.sessionId, resumeOptions as any);

        await this.assertSessionHealthy(session);

        await this.persistSessionMapping(normalizedKey, mapping.sessionId, requestedModel, mapping);
        this.sessions.set(normalizedKey, session);
        this.sessionModels.set(normalizedKey, requestedModel);
        this.sessionLastUsed.set(normalizedKey, Date.now());
        this.sessionSkillKeys.set(normalizedKey, this.buildSkillKey(skillDirectories));
        this.sessionWorkspaceKeys.set(normalizedKey, this.buildWorkspaceKey(reviewSessionOptions));
        this.database.touchCopilotSession(normalizedKey);
        return session;
      } catch (resumeError) {
        // Session no longer valid — remove stale mapping and create fresh
        console.warn(`[CopilotSession] Failed to resume session "${normalizedKey}": ${resumeError instanceof Error ? resumeError.message : String(resumeError)}. Creating fresh session.`);
        this.database.deleteCopilotSession(mapping.contextKey);
        if (mapping.contextKey !== normalizedKey) {
          this.database.deleteCopilotSession(normalizedKey);
        }
      }
    }

    // Create a new session
    const sessionOptions = this.buildSessionOptions(requestedModel, skillDirectories, disabledSkills, reviewSessionOptions);
    const session = await client.createSession(sessionOptions as any);

    await this.persistSessionMapping(normalizedKey, session.sessionId, requestedModel);
    this.sessions.set(normalizedKey, session);
    this.sessionModels.set(normalizedKey, requestedModel);
    this.sessionLastUsed.set(normalizedKey, Date.now());
    this.sessionSkillKeys.set(normalizedKey, this.buildSkillKey(skillDirectories));
    this.sessionWorkspaceKeys.set(normalizedKey, this.buildWorkspaceKey(reviewSessionOptions));
    return session;
  }

  /**
   * Evict the least-recently-used in-memory sessions when the limit is exceeded.
   * Evicted sessions can still be resumed from disk later.
   */
  private async evictOldestSessions(): Promise<void> {
    if (this.sessions.size < MAX_IN_MEMORY_SESSIONS) return;

    const entries = Array.from(this.sessionLastUsed.entries())
      .sort((a, b) => a[1] - b[1]); // oldest first

    const toEvict = entries.slice(0, this.sessions.size - MAX_IN_MEMORY_SESSIONS + 1);
    for (const [key] of toEvict) {
      const session = this.sessions.get(key);
      if (session) {
        try { await session.destroy(); } catch { /* ignore */ }
      }
      this.sessions.delete(key);
      this.sessionModels.delete(key);
      this.sessionLastUsed.delete(key);
      this.sessionSkillKeys.delete(key);
      this.sessionWorkspaceKeys.delete(key);
      // Keep the DB mapping so the session can be resumed later
    }
  }

  /**
   * Destroy a session and clean up all its in-memory + DB state.
   * Used by the retry logic when a stale session is detected.
   */
  private async destroyAndCleanSession(key: string): Promise<void> {
    const session = this.sessions.get(key);
    if (session) {
      try {
        await Promise.race([
          session.disconnect(),
          new Promise((resolve) => setTimeout(resolve, 5_000))
        ]);
      } catch { /* ignore */ }
      this.sessions.delete(key);
      this.sessionModels.delete(key);
      this.sessionLastUsed.delete(key);
      this.sessionSkillKeys.delete(key);
      this.sessionWorkspaceKeys.delete(key);
    }

    const mapping = this.getSessionMapping(key);
    if (mapping) {
      const client = await this.getClient();
      try { await client.deleteSession(mapping.sessionId); } catch { /* ignore */ }
      this.database.deleteCopilotSession(mapping.contextKey);
      if (mapping.contextKey !== key) {
        this.database.deleteCopilotSession(key);
      }
    }
  }

  private async handleSessionError(key: string, error: unknown): Promise<void> {
    // If the error suggests a broken session, remove it
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (
      message.includes('session') ||
      message.includes('disconnected') ||
      message.includes('not found') ||
      message.includes('timed out') ||
      message.includes('Timeout')
    ) {
      this.sessions.delete(key);
      this.sessionModels.delete(key);
      this.sessionLastUsed.delete(key);
      this.sessionSkillKeys.delete(key);
      this.sessionWorkspaceKeys.delete(key);
      const mapping = this.getSessionMapping(key);
      this.database.deleteCopilotSession(key);
      if (mapping && mapping.contextKey !== key) {
        this.database.deleteCopilotSession(mapping.contextKey);
      }
    }
  }

  private isSessionNotFoundError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? '');
    return (
      message.includes('Session not found') ||
      message.includes('session not found') ||
      message.includes('session.model.switchTo failed') ||
      message.includes('not found for sessionId')
    );
  }

  /** Stable key representing the set of skill directories, for change detection. */
  private buildSkillKey(skillDirectories?: string[]): string {
    if (!skillDirectories || skillDirectories.length === 0) return '';
    return [...skillDirectories].sort().join('|');
  }

  private buildWorkspaceKey(reviewSessionOptions?: ReviewSessionOptions): string {
    const workingDirectory = reviewSessionOptions?.workingDirectory?.trim();
    if (!workingDirectory) {
      return '';
    }
    const resolvedPath = resolve(workingDirectory);
    return process.platform === 'win32' ? resolvedPath.toLowerCase() : resolvedPath;
  }

  private normalizeContextKey(key: string, modelName?: string | null): string {
    if (!key.startsWith('review:')) {
      return key;
    }

    const requestedModel = normalizeSelectableModelId(modelName);
    const parsed = this.parseReviewKey(key);
    if (parsed) {
      return CopilotSessionManager.reviewKey(parsed.prRepo, parsed.prId, requestedModel);
    }

    return key;
  }

  private parseReviewKey(key: string): { prRepo: string; prId: number } | null {
    if (!key.startsWith('review:')) {
      return null;
    }

    const parts = key.split(':');
    if (parts.length < 3) {
      return null;
    }

    const prRepo = parts[1];
    const prId = Number.parseInt(parts[2] ?? '', 10);
    if (!prRepo || Number.isNaN(prId)) {
      return null;
    }

    return { prRepo, prId };
  }

  private getSessionMapping(key: string, requestedModel?: string | null) {
    const direct = this.database.getCopilotSession(key);
    if (direct) {
      return direct;
    }

    const parsed = this.parseReviewKey(key);
    if (!parsed) {
      return null;
    }

    const targetModel = normalizeSelectableModelId(requestedModel);
    const mappings = this.database.getCopilotSessionsForPr(parsed.prId, parsed.prRepo);
    if (mappings.length === 0) {
      return null;
    }

    return mappings.find((mapping) => normalizeSelectableModelId(mapping.modelName) === targetModel)
      ?? mappings.sort((a, b) => b.lastUsed.localeCompare(a.lastUsed))[0]
      ?? null;
  }

  private async ensureSessionModel(session: CopilotSession, key: string, requestedModel: string): Promise<void> {
    const currentModel = this.sessionModels.get(key) ?? AUTO_MODEL_ID;
    if (currentModel === requestedModel) {
      return;
    }

    if (requestedModel === AUTO_MODEL_ID) {
      this.sessionModels.set(key, requestedModel);
      const mapping = this.getSessionMapping(key, requestedModel);
      if (mapping) {
        await this.persistSessionMapping(key, mapping.sessionId, requestedModel, mapping);
      }
      return;
    }

    await session.setModel(requestedModel);
    this.sessionModels.set(key, requestedModel);
    const mapping = this.getSessionMapping(key, requestedModel);
    if (mapping) {
      await this.persistSessionMapping(key, mapping.sessionId, requestedModel, mapping);
    }
  }

  private buildSessionOptions(modelName: string, skillDirectories?: string[], disabledSkills?: string[], reviewSessionOptions?: ReviewSessionOptions): Record<string, unknown> {
    const options: Record<string, unknown> = {
      clientName: COPILOT_CLIENT_NAME,
      model: toSdkModel(modelName),
      streaming: true,
      onPermissionRequest: approveAll
    };
    if (skillDirectories?.length) {
      options.skillDirectories = skillDirectories;
    }
    if (disabledSkills?.length) {
      options.disabledSkills = disabledSkills;
    }
    if (reviewSessionOptions?.workingDirectory?.trim()) {
      options.workingDirectory = reviewSessionOptions.workingDirectory.trim();
    }
    return options;
  }

  private async assertSessionHealthy(session: CopilotSession): Promise<void> {
    await Promise.race([
      session.getMessages(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session health check timeout')), 8_000)
      )
    ]);
  }

  private async persistSessionMapping(
    key: string,
    sessionId: string,
    modelName: string,
    previousMapping?: { contextKey: string; createdAt: string; scope: string; prId: number | null; prRepo: string | null }
  ): Promise<void> {
    const now = new Date().toISOString();
    const scope = previousMapping?.scope ?? (key.startsWith('review:') ? 'review'
      : key.startsWith('ask:') ? 'ask'
      : key.startsWith('followup:') ? 'followup'
      : 'unknown');

    let prId: number | null = previousMapping?.prId ?? null;
    let prRepo: string | null = previousMapping?.prRepo ?? null;

    if (scope === 'review') {
      const parsed = this.parseReviewKey(key);
      prId = parsed?.prId ?? prId;
      prRepo = parsed?.prRepo ?? prRepo;
    }

    this.database.upsertCopilotSession({
      contextKey: key,
      sessionId,
      scope,
      prId,
      prRepo,
      modelName: modelName === AUTO_MODEL_ID ? null : modelName,
      createdAt: previousMapping?.createdAt ?? now,
      lastUsed: now
    });

    if (previousMapping && previousMapping.contextKey !== key) {
      this.database.deleteCopilotSession(previousMapping.contextKey);
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────

const anySignal = (signals: AbortSignal[]): AbortSignal => {
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      return controller.signal;
    }
    signal.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
};
