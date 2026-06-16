import { CopilotReviewResult, ReviewJob } from '@shared/types/models';

const SKILL_MARKER_PATTERN = /SKILL_MARKER_[A-Z0-9_]+/g;

const extractSkillMarkers = (skillMarkerUsage?: string): string[] => {
  if (!skillMarkerUsage) {
    return [];
  }

  return Array.from(new Set(skillMarkerUsage.match(SKILL_MARKER_PATTERN) ?? []));
};

const sortSkillNames = (skillNames: string[]): string[] => (
  [...skillNames].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
);

export const getUsedSkillNames = (
  job: Pick<ReviewJob, 'skillMarkerResults'>,
  result: Pick<CopilotReviewResult, 'skillMarkerUsage'> | null,
  storedSkillNamesByMarker?: ReadonlyMap<string, string>
): string[] => {
  const markerResults = job.skillMarkerResults ?? [];
  const markersFromResponse = extractSkillMarkers(result?.skillMarkerUsage);

  if (markersFromResponse.length > 0) {
    const markerToSkillName = new Map(storedSkillNamesByMarker ?? []);
    for (const entry of markerResults) {
      markerToSkillName.set(entry.marker, entry.skillName);
    }
    return sortSkillNames(Array.from(new Set(markersFromResponse.map((marker) => markerToSkillName.get(marker) ?? marker))));
  }

  return sortSkillNames(Array.from(new Set(markerResults.filter((entry) => entry.found).map((entry) => entry.skillName))));
};

export const hasReviewSkillPanelData = (
  job: Pick<ReviewJob, 'activeSkills' | 'skillMarkerResults'>
): boolean => ((job.activeSkills?.length ?? 0) > 0 || (job.skillMarkerResults?.length ?? 0) > 0);