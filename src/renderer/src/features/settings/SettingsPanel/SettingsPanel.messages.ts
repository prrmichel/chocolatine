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
  promptHelpIntro: 'The code-reviewer agent handles methodology and output formatting. Your prompt only needs to define what to review.',
  promptHelpHowToBuildTitle: 'How to build the prompt',
  promptHelpHowToBuild: `Your prompt should define four things:
1. Scope — what the review should focus on
2. Focus areas — Security, Correctness, Performance, Maintainability
3. Specific tasks — title verification, dependency review, work item alignment
4. Custom instructions — any additional context or constraints
The agent handles everything else.`,
  promptHelpParsingTitle: 'How results are parsed',
  promptHelpParsing: 'The code-reviewer agent is instructed to output structured results in a specific format. You do not need to repeat formatting instructions or schemas in your prompt — the agent enforces this automatically.',
  promptHelpChecklistTitle: 'Recommended checklist',
  promptHelpChecklist: `1) State review scope.
2) Define focus areas (Security, Correctness, Performance, Maintainability).
3) Specify concrete tasks (e.g., title review, dependency checks, work item alignment).
4) Add any custom instructions or constraints.`,
  promptHelpExampleTitle: 'Starter example (PR Review)',
  promptHelpCopyExample: 'Copy example to clipboard',
  closeHelp: 'Close',
  confirmDeleteTitle: 'Delete prompt',
  confirmDelete: 'Delete',
} as const;

export const PR_REVIEW_HELP_EXAMPLE = `You are a senior code reviewer performing a pull request review.

You will receive:
- Pull request title and metadata
- Code changes as unified diffs
- Depending on the execution context, read-only access to the PR review worktree

Review goals:
1. Review only the provided pull request changes.
2. Focus on Security, Correctness, Performance, and Maintainability.
3. Prioritize issues directly tied to changed lines.
4. Include evidence from the changes for each comment.
5. Do not invent issues when evidence is missing.

Additional tasks:
- Verify the pull request title is written in English. If not, propose a corrected English title.
- Review dependency additions or changes introduced by this PR. Flag unapproved third-party libraries.`;

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
