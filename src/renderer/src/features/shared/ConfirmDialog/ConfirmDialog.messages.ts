/** User-facing labels for ConfirmDialog */

export const LABELS = {
  confirm: 'Confirm',
  cancel: 'Cancel',
} as const;

export const typeToConfirmLabel = (confirmWord: string): string => `Type ${confirmWord} to confirm:`;