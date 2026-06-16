import { useState } from 'react';
import { PullRequestDetails, PullRequestFileDiff, PullRequestSummary, PullRequestWorkItem } from '@shared/types/models';
import { TASK_TYPE_WORK_ITEMS_SUMMARY } from '@shared/constants/timeouts';
import { formatPullRequestWorkItems } from '@shared/utils/prContext';
import { api } from '@renderer/services/api';
import { applyPromptTemplate } from '@renderer/utils/applyPromptTemplate';

interface UseWorkItemsSummaryParams {
  selectedSummary: PullRequestSummary | null | undefined;
  details: PullRequestDetails | null | undefined;
  workItems: PullRequestWorkItem[];
  diffs: PullRequestFileDiff[];
  workItemsSummaryModelName: string;
  workItemsSummaryPromptExtra: string;
  workItemsSummaryPrompts: { id: string; content: string }[];
  selectedWorkItemsPromptId: string | null;
  onError: (message: string) => void;
}

export function useWorkItemsSummary({
  selectedSummary,
  details,
  workItems,
  diffs,
  workItemsSummaryModelName,
  workItemsSummaryPromptExtra,
  workItemsSummaryPrompts,
  selectedWorkItemsPromptId,
  onError
}: UseWorkItemsSummaryParams) {
  const missingPromptMessage = 'Create a "Work Item changes summary" prompt in Prompt Library before generating a summary.';
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');

  const generate = async () => {
    if (!selectedSummary) return;

    const selectedWorkItemPrompt =
      workItemsSummaryPrompts.find((p) => p.id === selectedWorkItemsPromptId) ??
      workItemsSummaryPrompts[0] ??
      null;

    if (!selectedWorkItemPrompt) {
      onError(missingPromptMessage);
      return;
    }

    const workItemTemplate = applyPromptTemplate(selectedWorkItemPrompt.content, selectedSummary, details ?? null);

    const workItemsText = formatPullRequestWorkItems(workItems);

    const changesText =
      diffs.length > 0
        ? diffs.map((diff) => `File: ${diff.path}\n${diff.diffText}`).join('\n\n')
        : 'No changes loaded.';

    const summaryPrompt = [
      TASK_TYPE_WORK_ITEMS_SUMMARY,
      '[SELECTED_PROMPT_TEMPLATE]',
      workItemTemplate,
      '',
      '[CUSTOM_SUMMARY_INSTRUCTIONS]',
      workItemsSummaryPromptExtra.trim() || 'None.',
      '',
      '[WORK_ITEM_DESCRIPTION]',
      workItemsText,
      '',
      '[CODE_CHANGES]',
      changesText
    ].join('\n');

    setLoading(true);
    try {
      await api.enqueueReview(selectedSummary, summaryPrompt, workItemsSummaryModelName);
      setText('');
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return { loading, text, generate } as const;
}
