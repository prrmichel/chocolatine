import { approveAll, CopilotClient } from '@github/copilot-sdk';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { buildCopilotClientOptions } from '@main/utils/copilotClientOptions';
import { toSdkModel } from '@shared/constants/modelOptions';
import { COPILOT_TIMEOUT_MS } from '@shared/constants/timeouts';
import type { ReviewSessionOptions } from '@shared/types/models';

const COPILOT_CLIENT_NAME = 'Chocolatine';

/**
 * Gateway to the Copilot API.
 *
 * When a `CopilotSessionManager` is attached (via `setSessionManager`), calls
 * with a `sessionKey` option delegate to persistent sessions — the model
 * remembers all prior turns for the same key.
 *
 * Calls without a `sessionKey` (or without a session manager) use the legacy
 * fire-and-forget pattern: new CopilotClient + session per request.
 */
export class CopilotReviewService {
  private sessionManager?: CopilotSessionManager;

  setSessionManager(manager: CopilotSessionManager): void {
    this.sessionManager = manager;
  }

  /**
   * Send a prompt to Copilot and return the response.
   *
   * @param prompt  The full prompt text.
   * @param modelName  Model to use (null / 'Auto' lets the SDK pick).
   * @param options.sessionKey  If provided and a session manager is set,
   *   the call goes through persistent sessions.  Without it, a one-shot
   *   client+session is created and torn down (backward-compat for
   *   `generateSummary` and similar one-off calls).
   */
  async requestReview(
    prompt: string,
    modelName?: string | null,
    options?: {
      onDelta?: (delta: string, fullText: string) => void;
      onModelUsed?: (modelName: string) => void;
      onUsage?: (payload: unknown) => void;
      signal?: AbortSignal;
      timeoutMs?: number;
      sessionKey?: string;
      skillDirectories?: string[];
      disabledSkills?: string[];
      reviewSessionOptions?: ReviewSessionOptions;
    }
  ): Promise<string> {
    // ── Persistent-session path ──────────────────────────────────
    if (options?.sessionKey && this.sessionManager) {
      return this.sessionManager.sendMessage(
        options.sessionKey,
        prompt,
        modelName,
        {
          onDelta: options.onDelta,
          onModelUsed: options.onModelUsed,
          onUsage: options.onUsage,
          signal: options.signal,
          timeoutMs: options.timeoutMs,
          skillDirectories: options.skillDirectories,
          disabledSkills: options.disabledSkills,
          reviewSessionOptions: options.reviewSessionOptions
        }
      );
    }

    // ── Legacy fire-and-forget path ──────────────────────────────
    if (!prompt.trim()) {
      throw new Error('Prompt is empty.');
    }
    const client = new CopilotClient(buildCopilotClientOptions());
    let session: Awaited<ReturnType<CopilotClient['createSession']>> | null = null;
    try {
      const timeoutMs = options?.timeoutMs ?? COPILOT_TIMEOUT_MS;
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);
      const signal = options?.signal
        ? anySignal([options.signal, timeoutController.signal])
        : timeoutController.signal;
      session = await client.createSession({
        clientName: COPILOT_CLIENT_NAME,
        model: toSdkModel(modelName),
        streaming: Boolean(options?.onDelta),
        onPermissionRequest: approveAll,
        ...(options?.reviewSessionOptions?.workingDirectory?.trim()
          ? { workingDirectory: options.reviewSessionOptions.workingDirectory.trim() }
          : {})
      });

      const abortListener = () => {
        void session.abort();
      };
      if (signal) {
        signal.addEventListener('abort', abortListener, { once: true });
      }

      let fullText = '';
      if (options?.onDelta) {
        session.on('assistant.message_delta', (event) => {
          if (event?.agentId) {
            return;
          }
          const delta = event?.data?.deltaContent ?? '';
          if (!delta) {
            return;
          }
          fullText += delta;
          options.onDelta?.(delta, fullText);
        });
      }

      if (options?.onModelUsed) {
        session.on('assistant.usage', (event) => {
          const actualModel = event?.data?.model;
          if (actualModel) {
            options.onModelUsed?.(actualModel);
          }
          options.onUsage?.(event?.data);
        });
      } else if (options?.onUsage) {
        session.on('assistant.usage', (event) => {
          options.onUsage?.(event?.data);
        });
      }

      try {
        const abortPromise = new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new Error(`Copilot request timed out after ${Math.round(timeoutMs / 60_000)} minutes.`));
            return;
          }
          signal.addEventListener('abort', () => reject(new Error(`Copilot request timed out after ${Math.round(timeoutMs / 60_000)} minutes.`)), { once: true });
        });

        const sendPromise = session.sendAndWait({ prompt }, timeoutMs + 30_000);
        sendPromise.catch(() => {});

        const response = await Promise.race([sendPromise, abortPromise]);
        if (!fullText) {
          fullText = response?.data?.content ?? '';
        }
        return fullText.trim();
      } catch (error) {
        if (timeoutController.signal.aborted) {
          throw new Error(`Copilot request timed out after ${Math.round(timeoutMs / 60_000)} minutes.`);
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
        if (signal) {
          signal.removeEventListener('abort', abortListener);
        }
      }
    } finally {
      if (session) {
        try {
          await session.destroy();
        } catch {
          // Ignore session cleanup errors during one-shot requests
        }
      }
      await client.stop();
    }
  }
}

const anySignal = (signals: AbortSignal[]) => {
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
