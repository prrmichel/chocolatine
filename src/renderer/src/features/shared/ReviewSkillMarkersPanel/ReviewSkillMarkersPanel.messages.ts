/** User-facing labels for ReviewSkillMarkersPanel */

export const LABELS = {
  skills: 'Skills',
  applied: 'applied',
  notApplied: 'not applied',
  pending: 'pending',
} as const;

export const skillsHeader = (count: number): string => `${LABELS.skills} (${count})`;

export const markerStatusTitle = (found: boolean, marker: string): string =>
  found ? `Marker found in response: ${marker}` : `Marker NOT found in response: ${marker}`;

export const pendingMarkerTitle = 'Marker verification pending';