/** User-facing labels for ReviewsTab, RunHeader and RunResult */

export const LABELS = {
  // ReviewsTab
  noRuns: 'No runs',
  allRuns: 'All',
  clearSeverityFilter: 'Clear severity filter',
  copyRawResponse: 'Copy',
  deleteReviewRuns: 'Delete review runs',
  deleteAllRunsTitle: 'Delete all review runs for this PR',
  deleteSelectedRunTitle: 'Delete selected review run',
  markAllReadLabel: 'Mark all visible comments as read',
  markAllReadTitleAll: 'Mark all comments as read',
  markAllReadTitleSingle: 'Mark all comments in this run as read',
  markAllUnreadLabel: 'Mark all visible comments as unread',
  markAllUnreadTitleAll: 'Mark all comments as unread',
  markAllUnreadTitleSingle: 'Mark all comments in this run as unread',
  promptTemplate: 'Prompt template',
  queueReview: 'Queue review',
  queueReviewPromptRequired: 'Create a "PR Review" prompt in Prompt Library before launching a review.',
  modelCatalogUnavailable: 'Model catalog unavailable. Review launch is blocked.',
  loadingChanges: 'Loading changes...',
  branchContextHeading: 'Branch context',
  prepareBranchContext: 'Prepare branch context',
  refreshBranchContext: 'Refresh branch context',
  branchContextReady: 'Ready',
  branchContextRefreshing: 'Refreshing',
  branchContextBlocked: 'Needs setup',
  branchContextUnavailable: 'Unavailable',
  branchContextInitial: 'Branch context will be prepared automatically when you start a review.',
  branchContextRootRequired: 'Configure a review worktree root folder in Settings > Preferences to enable branch-aware review.',
  branchContextPreparing: 'Preparing branch context...',
  branchContextConfigureActionDisabled: 'Configure a review worktree root folder first',
  branchContextOpenSettings: 'Open Settings',
  branchContextBranches: 'Branches',
  branchContextBaseCommit: 'Base commit',
  branchContextHeadCommit: 'Head commit',
  branchContextWorktreePath: 'Worktree',
  branchContextMirrorPath: 'Mirror',
  branchContextUpdated: 'Updated',
  customInstructionsPlaceholder: 'Custom instructions (appended to prompt)...',
  excludedFilePatternsPlaceholder: 'Exclude file types (e.g. *.md; *.json)',
  emptyNoRuns: 'No review runs for this pull request.',
  emptyNoMatchFilter: 'No comments match the selected severity filter.',
  emptySelectRun: 'Select a run to view comments.',
  confirmDeleteAllTitle: 'Delete all runs',
  confirmDeleteSingleTitle: 'Delete run',
  confirmDeleteAllMessage: 'Delete all review runs for this pull request? This cannot be undone.',
  confirmDeleteSingleMessage: 'Delete this review run? This cannot be undone.',
  confirmDelete: 'Delete',

  // RunHeader
  titleInEnglish: 'Title in English',
  titleNotInEnglish: 'Title not in English',
  usedSkillsLabel: 'Used skills:',
  chatAboutRun: 'Chat about this review run',
  viewExecutedPrompt: 'View executed prompt',

  // RunResult
  summaryLabel: 'Summary:',
  titleReviewLabel: 'Title review:',
  currentTitleLabel: 'Current:',
  suggestedTitleLabel: 'Suggested:',
  titleNotesLabel: 'Notes:',
  contextProofLabel: 'Context proof:',
  reviewUsageDiagnosticsLabel: 'Usage:',
  reviewContextLabel: 'Review context:',
  reviewContextBranchAware: 'Branch-aware',
  reviewContextDiffOnly: 'Diff-only',
  reviewContextFallbackBadge: 'Fallback review',
  reviewContextFallbackLabel: 'Fallback:',
  reviewContextRequestedBranchAware: 'Requested branch-aware mode',
  reviewContextRetryHint: 'Refresh Branch context and rerun the review to retry branch-aware mode.',
  attemptPrefix: 'Attempt #',
  sessionReusedLabel: 'Session reused:',
  yes: 'Yes',
  no: 'No',
  priorLabel: 'Prior:',
  serverSideLabel: 'Server-side:',
  reReviewOnSession: 'Re-review on existing session',
  sessionLabel: 'Session:',
  usedSkillsFallbackLabel: 'Used skills',
  noCommentsYet: 'No comments yet.',
  readBadge: 'Read',
  markAsUnread: 'Mark as unread',
  markAsRead: 'Mark as read',
  filterBySeverity: 'Filter by severity',
  goToFileInChanges: 'Go to file in Changes',
  dash: '-',
  messageLabel: 'Message:',
  solutionLabel: 'Solution:',
  suggestionLabel: 'Suggestion:',
  evidenceLabel: 'Evidence:',
  copyCommentMarkdown: 'Copy comment as markdown',
  copied: 'Copied!',
  copyMessage: 'Copy message',
  copySolution: 'Copy solution',
  copySuggestion: 'Copy suggestion',
} as const;

// Template functions for dynamic labels
export const runSelectLabel = (n: number, model: string, date: string): string =>
  `Run ${n} - ${model} - ${date}`;

export const runHeaderTitle = (n: number, model: string, date: string): string =>
  `Run ${n} · ${model} · ${date}`;

export const severityBadgeTitle = (count: number, severity: string): string =>
  `${count} ${severity} comment(s)`;

export const usedSkillsTitle = (skills: string[]): string =>
  skills.length > 0 ? `Used skills: ${skills.join(', ')}` : 'Used skills';

export const executedPromptTitle = (runNumber: number): string =>
  `Executed prompt - Run ${runNumber}`;

export const severityFilterLabel = (severity: string): string =>
  `Severity: ${severity} ×`;
