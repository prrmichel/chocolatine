/** User-facing labels for PromptPreviewModal */

export const LABELS = {
  copyPrompt: 'Copy prompt',
  close: 'Close',
  noPromptContent: '(No prompt content)',
  skills: 'Skills',
  applied: 'applied',
  notApplied: 'not applied',
  reReviewSameSession: 'Re-review (same session)',
  newSession: 'New session',
  copyThisPrompt: 'Copy this prompt',
  currentPrompt: 'Current prompt',
} as const;

export const skillsHeader = (count: number): string => `${LABELS.skills} (${count})`;

export const markerStatusTitle = (found: boolean, marker: string): string =>
  found ? `Marker found in response: ${marker}` : `Marker NOT found in response: ${marker}`;

export const passLabel = (attempt: number, total: number, startedAt: string): string =>
  `Pass #${attempt} of ${total} - ${new Date(startedAt).toLocaleString()}`;

export const passLatestLabel = (total: number, startedAt?: string | null): string =>
  `${LABELS.currentPrompt === 'Current prompt' && total > 1 ? `Pass #${total} of ${total} (latest)` : LABELS.currentPrompt}${startedAt ? ` - ${new Date(startedAt).toLocaleString()}` : ''}`;

export const sessionTitle = (sessionKey?: string | null): string => `Session: ${sessionKey ?? 'unknown'}`;