/** User-facing labels for WorkItemsTab */

export const LABELS = {
  loadingWorkItems: 'Loading work items...',
  noWorkItems: 'No work items.',
  title: 'Title',
  description: 'Description',
  acceptanceCriteria: 'Acceptance criteria',
  reproStepsDescription: 'Repro Steps / Newsletter Description',
  comments: 'Comments',
  noComments: 'No comments.',
  noPromptOption: 'No work-item summary prompt',
  noPromptHelp: 'Create one in Prompt Library or insert a starter template.',
  generateSummaryPromptRequired: 'Create a "Work Item changes summary" prompt in Prompt Library before generating a summary.',
  generatingSummaryBtn: 'Generating summary...',
  generateSummaryBtn: 'Generate changes summary',
  customSummaryInstructions: 'Custom summary instructions',
  summaryGenerations: 'Summary generations',
  noSummaryYet: 'No summary generation yet.',
  viewExecutedPrompt: 'View executed prompt',
  deleteGeneration: 'Delete this summary generation',
  noResultYet: '(No result yet)',
  confirmDeleteTitle: 'Delete summary generation',
  confirmDeleteMessage:
    'This will remove this summary generation from the queue/history and persisted storage.',
  confirmDelete: 'Delete',
  cancel: 'Cancel',
} as const;

export const generationLabel = (n: number): string => `Generation ${n}`;

export const executedPromptTitle = (n: number): string =>
  `Executed prompt · Generation ${n}`;
