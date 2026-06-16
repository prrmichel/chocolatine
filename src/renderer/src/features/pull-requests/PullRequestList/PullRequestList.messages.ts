/** User-facing labels for PullRequestList */

export const LABELS = {
  statusActive: 'Active',
  statusCompleted: 'Completed',
  statusAbandoned: 'Abandoned',
  statusAll: 'All',
  switchPrSource: 'Switch PR source',
  refreshPRs: 'Refresh pull requests',
  pinList: 'Pin pull request list',
  unpinList: 'Unpin pull request list',
  filterPlaceholder: 'Filter pull requests',
  filterAssigned: 'Filter assigned to me',
  setDisplayNameHint: 'Set your ADO display name in Settings to use this filter',
  filterAssignedNoName: 'Filter: assigned to me (set name in Settings)',
  allAuthors: 'All authors',
  noPRs: 'No pull requests found.',
  unknownAuthor: 'Unknown author',
  runDefaultReview: 'Run standard branch-aware review',
  runReviewUnavailable: 'Model catalog unavailable. Review launch is blocked.',
  draft: 'Draft',
} as const;

export const prCountLabel = (count: number): string => `${count} PR(s)`;

export const showPRsAssignedTo = (name: string): string =>
  `Show PRs assigned to: ${name}`;

export const runReviewTitle = (count: number): string =>
  `Run standard branch-aware review · ${count} existing run(s)`;
