/** User-facing labels for SettingsPanel (Prompt Library) */

import type { PromptCategory } from '@shared/types/models';

export const LABELS = {
  addPrompt: 'Add prompt',
  deleteSelected: 'Delete selected prompt',
  allCategories: 'All categories',
  categoryPRReview: 'PR Review',
  categoryWorkItemSummary: 'Work Item changes summary',
  setDefault: 'Set as default for this category',
  promptHelp: 'Prompt help',
  noPromptForCategory: 'No prompt for this category.',
  noPromptForCategoryHint: 'Runs are blocked until you create a prompt for this category.',
  insertPRReviewStarter: 'Insert PR Review starter',
  insertWorkItemStarter: 'Insert Work Item starter',
  starterHelp: 'Starter templates are optional helpers. They are never auto-injected into runs.',
  category: 'Category',
  name: 'Name',
  content: 'Content',
  savePromptChanges: 'Save prompt changes',
  noPromptSelected: 'No prompt selected.',
  promptHelpTitle: 'How to write your first PR Review prompt',
  promptHelpIntro: 'Use this guide to build a PR Review prompt that the app can parse reliably.',
  promptHelpHowToBuildTitle: 'How to build the prompt',
  promptHelpHowToBuild: 'Ask the model to review only provided changes, focus on actionable findings, and return strict JSON only.',
  promptHelpParsingTitle: 'How results are parsed',
  promptHelpParsing: 'The app extracts top-level JSON object(s) from the model response and parses comments. Invalid JSON or markdown-wrapped output prevents structured parsing.',
  promptHelpChecklistTitle: 'Recommended checklist',
  promptHelpChecklist: '1) State review scope. 2) Require strict JSON-only output. 3) Provide the expected schema. 4) Define line/file conventions for global findings.',
  promptHelpExampleTitle: 'Starter example (PR Review)',
  closeHelp: 'Close help',
  confirmDeleteTitle: 'Delete prompt',
  confirmDelete: 'Delete',
} as const;

export const PR_REVIEW_HELP_EXAMPLE = `You are a senior code reviewer.

Review only the provided pull request changes.
Focus on Security, Performance, Correctness, and Maintainability.
Do not invent issues without evidence.

Return strict JSON only (no markdown, no extra text) using:
{
  "titleReview": {
    "currentTitle": "{Title}",
    "isEnglish": true,
    "suggestedEnglishTitle": "",
    "notes": ""
  },
  "comments": [
    {
      "id": "C1",
      "reviewArea": "<technology>",
      "category": "Security|Performance|Correctness|Maintainability|Style|Title",
      "severity": "Info|Warning|Critical",
      "file": "path/or/empty",
      "lineNew": 0,
      "lineOld": 0,
      "message": "What is wrong and why",
      "suggestion": "Concrete improvement",
      "solution": "How to fix it",
      "evidence": "Quote from changes"
    }
  ],
  "overallSummary": "Short summary of changes and key risks",
  "skillMarkerUsage": "List skill markers used, if any"
}

Rules:
- If line numbers are unknown, use 0.
- If the issue is general (not a specific file), use 'file=""' and 'lineNew=0', 'lineOld=0'.
- If a finding depends on unchanged code inspected through the review worktree, make the dependency on the PR change explicit in 'message' or 'evidence'.
- Do not invent issues; only comment when evidence exists in the diff or in directly relevant review-worktree context.
- Keep comments concise but actionable.
- If there is no issue for a section, return valid JSON with an empty 'comments' array rather than explanatory prose.
`;

export const confirmDeleteMessage = (name: string): string =>
  `Delete "${name}"? This action cannot be undone.`;

export const categoryLabel = (category: PromptCategory | 'all'): string => {
  if (category === 'all') {
    return LABELS.allCategories;
  }

  return category === 'PR Review'
    ? LABELS.categoryPRReview
    : LABELS.categoryWorkItemSummary;
};
