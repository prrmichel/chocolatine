/** User-facing labels for FollowUpTab */

export const LABELS = {
  noReviewRuns: 'No review runs yet.',
  collapsePanel: 'Collapse follow-up panel',
  emptyConversations:
    'No follow-up conversations. Use "Chat about this run" in the Reviews tab to start one.',
  deleteConversation: 'Delete conversation',
  emptySelectConversation:
    'Select a follow-up conversation or start one from the Reviews tab.',
  review: 'Review',
  sameSession: 'same session',
  copyPrompt: 'Copy prompt',
  copyResponse: 'Copy response',
  copilot: 'Copilot',
  followUpConversation: 'Follow-up conversation',
  inputPlaceholder: 'Ask a follow-up question... (Ctrl+Enter to send)',
  cancel: 'Cancel',
  send: 'Send',
  confirmDeleteTitle: 'Delete conversation',
  confirmDeleteMessage:
    'Delete this follow-up conversation? This cannot be undone.',
  confirmDelete: 'Delete',
} as const;

export const reviewPassLabel = (n: number, total: number): string =>
  `Review pass #${n}/${total}`;

export const reviewPassLatestLabel = (n: number, total: number): string =>
  `Review pass #${n}/${total} (latest)`;
