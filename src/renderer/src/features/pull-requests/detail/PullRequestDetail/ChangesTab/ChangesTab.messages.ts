/** User-facing labels for ChangesTab */

export const LABELS = {
  runsGroup: 'Runs',
  allRuns: 'All runs',
  none: 'None',
  hideAllGeneratedComments: 'Hide all generated comments',
  userComments: 'User comments',
  shown: 'Shown',
  hidden: 'Hidden',
  readComments: 'Read comments',
  unreadComments: 'Unread comments',
  markAllReadTitleAll: 'Mark all comments as read',
  markAllReadTitleSelected: 'Mark selected run comments as read',
  markAllUnreadTitleAll: 'Mark all comments as unread',
  markAllUnreadTitleSelected: 'Mark selected run comments as unread',
  loadingChanges: 'Loading changes...',
  noChanges: 'No changes loaded.',
  filterFiles: 'Filter files',
  unpinFileTree: 'Unpin file tree',
  pinFileTree: 'Pin file tree',
  noFileSelected: 'No file selected',
  copyFilePath: 'Copy file path',
  showDiffOnly: 'Show diff only',
  loadAllLines: 'Load all lines',
  inlineMode: 'Inline mode',
  sideMode: 'Side mode',
  diffViewMode: 'Diff view mode',
  prComments: 'PR Comments',
  fileComments: 'File Comments',
  fileLevelCommentsPrefix: 'File-level comments',
  fileLevelCommentsHint:
    'These comments have no line information and cannot be placed in the diff',
  markAsUnread: 'Mark as unread',
  markAsRead: 'Mark as read',
  readBadge: 'Read',
  suggestionLabel: 'Suggestion:',
  referencedLineNotInDiff: ' · referenced line not in diff view',
  followUp: 'Follow-up',
  askMe: 'Ask me',
  askMeTitle: 'Ask Copilot about selected code',
} as const;

export const copilotRunLabel = (n: number): string => `Copilot · Run ${n}`;

export const lineLabel = (n: number): string => `Line ${n}`;
