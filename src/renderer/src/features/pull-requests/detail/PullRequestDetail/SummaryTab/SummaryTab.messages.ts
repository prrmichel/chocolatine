/** User-facing labels for SummaryTab */

export const LABELS = {
  generalInfo: 'General information',
  loadingPRInfo: 'Loading pull request info...',
  author: 'Author',
  sourceBranch: 'Source branch',
  targetBranch: 'Target branch',
  copySourceBranch: 'Copy source branch path',
  copyTargetBranch: 'Copy target branch path',
  reviewers: 'Reviewers',
  loadingReviewers: 'Loading reviewers...',
  noReviewers: 'No reviewers.',
  groups: 'Groups',
  noGroups: 'No groups.',
  users: 'Users',
  noUsers: 'No users.',
  reviewsSummary: 'Reviews summary',
  noReviewRuns: 'No review runs yet.',
  noComments: 'No comments found across review runs.',
  runHeader: 'Run',
  modelHeader: 'Model',
  dateHeader: 'Date',
  totalHeader: 'Total',
  emDash: '—',
} as const;

export const runLabel = (n: number): string => `Run ${n}`;
