/** User-facing labels for App shell */

export const LABELS = {
  tasksResultsDebug: 'Tasks results debug',
  openSettings: 'Open settings',
  close: 'Close',
  loading: 'Loading...',
  pinPRList: 'Pin pull request list',
  untitledPR: '(Untitled pull request)',
} as const;

/** Tab labels used in useUIStore */
export const TAB_LABELS = {
  pullRequests: 'Pull Requests',
  tasksResults: 'Tasks results',
  promptLibrary: 'Prompt library',
  ask: 'Ask',
} as const;
