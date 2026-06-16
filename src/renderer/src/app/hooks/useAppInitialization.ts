import { useEffect, useState } from 'react';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import { useReviewStore } from '@renderer/features/review-queue/state/useReviewStore';
import { applyPromptTemplate } from '@renderer/utils/applyPromptTemplate';
import { KNOWN_MODELS } from '@shared/constants/modelOptions';
import type { PullRequestDetails, PullRequestSummary, PromptTemplate } from '@shared/types/models';

interface UseAppInitializationParams {
  selectedSummary: PullRequestSummary | null | undefined;
  details: PullRequestDetails | null | undefined;
  prReviewPrompts: PromptTemplate[];
  workItemsSummaryPrompts: PromptTemplate[];
  onError: (message: string) => void;
  setPromptText: (text: string) => void;
}

/**
 * Handles one-time app startup (loading settings, prompt library, jobs) and
 * keeps prompt-related derived state (selected prompt IDs, prompt text) in sync.
 */
export function useAppInitialization({
  selectedSummary,
  details,
  prReviewPrompts,
  workItemsSummaryPrompts,
  onError,
  setPromptText
}: UseAppInitializationParams) {
  const {
    promptLibrary,
    workItemsSummaryPromptLoaded,
    workItemsSummaryPromptExtra,
    loadSettings,
    loadPromptLibrary,
    loadWorkItemsSummaryInstructions,
    persistWorkItemsSummaryInstructions,
    loadDynamicModels
  } = useSettingsStore();

  const { loadJobs, loadPersistedJobs, subscribeToQueueChanges } = useReviewStore();

  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [selectedWorkItemsPromptId, setSelectedWorkItemsPromptId] = useState<string | null>(null);

  // ── One-time bootstrap ──
  useEffect(() => {
    loadSettings().catch((err) => onError(String(err)));
    loadPromptLibrary().catch((err) => onError(String(err)));
    loadJobs().catch((err) => onError(String(err)));
    loadPersistedJobs().catch((err) => onError(String(err)));
    loadWorkItemsSummaryInstructions();
    void loadDynamicModels();
    const unsubscribe = subscribeToQueueChanges();

    // If models are still empty after initial load, retry every 10 s for up to 2 min
    let retryCount = 0;
    const startupRetry = setInterval(() => {
      if (KNOWN_MODELS.length > 0 || retryCount >= 12) {
        clearInterval(startupRetry);
        return;
      }
      retryCount++;
      void loadDynamicModels();
    }, 10_000);

    // Refresh model list every 30 minutes
    const modelRefreshInterval = setInterval(() => {
      void loadDynamicModels();
    }, 30 * 60 * 1000);

    return () => {
      unsubscribe();
      clearInterval(startupRetry);
      clearInterval(modelRefreshInterval);
    };
  }, [loadDynamicModels, loadJobs, loadPersistedJobs, loadPromptLibrary, loadSettings, loadWorkItemsSummaryInstructions, onError, subscribeToQueueChanges]);

  // ── Keep selected review prompt in sync ──
  useEffect(() => {
    if (!promptLibrary) return;
    if (!selectedPromptId || !prReviewPrompts.find((p) => p.id === selectedPromptId)) {
      const defaultId =
        promptLibrary.defaultPromptIdByCategory?.['PR Review'] ??
        promptLibrary.defaultPromptId ??
        prReviewPrompts[0]?.id ??
        null;
      setSelectedPromptId(defaultId);
    }
  }, [promptLibrary, prReviewPrompts, selectedPromptId]);

  // ── Keep selected work-items prompt in sync ──
  useEffect(() => {
    if (!promptLibrary) return;
    if (
      !selectedWorkItemsPromptId ||
      !workItemsSummaryPrompts.find((p) => p.id === selectedWorkItemsPromptId)
    ) {
      const defaultId =
        promptLibrary.defaultPromptIdByCategory?.['Work Item changes summary'] ??
        workItemsSummaryPrompts[0]?.id ??
        null;
      setSelectedWorkItemsPromptId(defaultId);
    }
  }, [promptLibrary, workItemsSummaryPrompts, selectedWorkItemsPromptId]);

  // ── Re-render prompt text when template inputs change ──
  useEffect(() => {
    if (!selectedSummary || !promptLibrary) return;
    const prompt = prReviewPrompts.find((p) => p.id === selectedPromptId) ?? prReviewPrompts[0];
    const template = prompt?.content ?? '';
    setPromptText(applyPromptTemplate(template, selectedSummary, details ?? null));
  }, [selectedSummary, details, promptLibrary, selectedPromptId, prReviewPrompts, setPromptText]);

  // ── Debounced save of work-items summary instructions ──
  useEffect(() => {
    if (!workItemsSummaryPromptLoaded) return;
    const timer = setTimeout(() => {
      persistWorkItemsSummaryInstructions().catch((err) => onError(String(err)));
    }, 300);
    return () => clearTimeout(timer);
  }, [workItemsSummaryPromptLoaded, workItemsSummaryPromptExtra, onError, persistWorkItemsSummaryInstructions]);

  return {
    selectedPromptId,
    setSelectedPromptId,
    selectedWorkItemsPromptId,
    setSelectedWorkItemsPromptId
  } as const;
}
