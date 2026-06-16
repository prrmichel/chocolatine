/** User-facing labels for PromptResults */

export const LABELS = {
  panelHeader: 'Tasks results',
  tasks: 'Tasks',
  debugLogs: 'Debug Logs',
  promptSent: 'Prompt Sent',
  response: 'Response',
  streaming: 'Streaming',
  live: 'LIVE',
  noResults: 'No results yet.',
  noResponseYet: 'No response yet.',
  noDebugLogsYet: 'No debug logs yet.',
  selectTaskToViewLogs: 'Select a task to view its logs.',
  copy: 'Copy',
} as const;

export const tasksHeader = (count: number): string => `${LABELS.tasks} (${count})`;

export const tabLabelWithCount = (label: string, count: number): string => `${label} (${count})`;

export const charsLabel = (label: string, count: number): string => `${label} (${count.toLocaleString()} chars)`;
