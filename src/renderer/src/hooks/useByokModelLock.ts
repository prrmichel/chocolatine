import { useMemo } from 'react';
import { isByokModel } from '@shared/constants/modelOptions';

interface UseByokModelLockParams {
  /** The model name of the current context (or fallback when no context exists). */
  contextModelName: string | null | undefined;
  /** Whether the context is "consumed":
   *   - AskTab: `(activeContext?.messages.length ?? 0) > 0`
   *   - FollowUpTab: `activeContext !== null` (already post-review) */
  hasMessages: boolean;
  /** All available model options. */
  modelOptions: ReadonlyArray<{ id: string; label: string }>;
  /** Tooltip message shown when the selector is fully locked (BYOK model in use). */
  lockMessage?: string;
}

interface UseByokModelLockResult {
  /** Model options filtered by the current lock state. */
  filteredModelOptions: ReadonlyArray<{ id: string; label: string }>;
  /** Whether the selector is fully locked — disabled with a tooltip. */
  isFullyLocked: boolean;
  /** Whether the context is partially locked — BYOK options are hidden. */
  isPartiallyLocked: boolean;
  /** Pass-through for ModelSelect.disabled. */
  disabled: boolean;
  /** Pass-through for ModelSelect.disabledMessage. */
  disabledMessage: string | undefined;
}

/**
 * Derives the BYOK model-lock state for a chat/ask/follow-up context.
 *
 * Three lock states:
 *  1. No messages → free (all models, including BYOK)
 *  2. Messages + BYOK model → fully locked (selector disabled)
 *  3. Messages + non-BYOK model → partially locked (BYOK models hidden)
 *
 * `hasMessages` lets each caller define what "consumed" means.
 */
export function useByokModelLock({
  contextModelName,
  hasMessages,
  modelOptions,
  lockMessage
}: UseByokModelLockParams): UseByokModelLockResult {
  return useMemo(() => {
    const isByok = isByokModel(contextModelName ?? '');
    const isFullyLocked = hasMessages && isByok;
    const isPartiallyLocked = hasMessages && !isByok;

    const filteredModelOptions = isPartiallyLocked
      ? modelOptions.filter((opt) => !isByokModel(opt.id))
      : modelOptions;

    return {
      filteredModelOptions,
      isFullyLocked,
      isPartiallyLocked,
      disabled: isFullyLocked,
      disabledMessage: isFullyLocked ? lockMessage : undefined
    };
  }, [contextModelName, hasMessages, modelOptions, lockMessage]);
}
