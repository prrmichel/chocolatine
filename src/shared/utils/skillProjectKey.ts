const DISALLOWED_KEY_CHARS = /[<>:"/\\|?*]/g;
const WHITESPACE = /\s+/g;

const sanitizeKeyPart = (value: string): string =>
  value.trim().replace(DISALLOWED_KEY_CHARS, '-').replace(WHITESPACE, '-').toLowerCase();

const toCanonicalPart = (value: string): string => value.trim().toLowerCase();

const buildCanonicalSkillProjectKeyPreservingCase = (organizationName: string, projectName: string): string =>
  `${encodeURIComponent(organizationName.trim())}__${encodeURIComponent(projectName.trim())}`;

/** Legacy key format kept for compatibility with already-synced records. */
export const buildLegacySkillProjectKey = (organizationName: string, projectName: string): string =>
  `${sanitizeKeyPart(organizationName)}_${sanitizeKeyPart(projectName)}`;

/**
 * Canonical, collision-safe project key.
 * Encodes raw values to avoid collisions introduced by lossy sanitization.
 */
export const buildCanonicalSkillProjectKey = (organizationName: string, projectName: string): string =>
  `${encodeURIComponent(toCanonicalPart(organizationName))}__${encodeURIComponent(toCanonicalPart(projectName))}`;

export const buildSkillProjectKeyCandidates = (organizationName?: string | null, projectName?: string | null): string[] => {
  const org = organizationName?.trim();
  const project = projectName?.trim();
  if (!org || !project) {
    return [];
  }

  const canonical = buildCanonicalSkillProjectKey(org, project);
  const preservedCanonical = buildCanonicalSkillProjectKeyPreservingCase(org, project);
  const legacy = buildLegacySkillProjectKey(org, project);

  const candidates = [canonical];
  if (preservedCanonical !== canonical) {
    candidates.push(preservedCanonical);
  }
  if (!candidates.includes(legacy)) {
    candidates.push(legacy);
  }
  return candidates;
};

export const normalizeSkillProjectKeyForMatch = (projectKey: string | null | undefined): string => {
  if (!projectKey) {
    return '';
  }

  if (projectKey.includes('__')) {
    const [encodedOrg, encodedProject] = projectKey.split('__');
    if (encodedOrg && encodedProject) {
      try {
        return buildCanonicalSkillProjectKey(decodeURIComponent(encodedOrg), decodeURIComponent(encodedProject));
      } catch {
        // Fall through to legacy normalization.
      }
    }
  }

  return projectKey.toLowerCase();
};

export const matchesSkillProjectKeyCandidates = (
  skillProjectKey: string | null | undefined,
  candidateProjectKeys: string[]
): boolean => {
  if (candidateProjectKeys.length === 0) {
    return false;
  }

  const normalizedSkillKey = normalizeSkillProjectKeyForMatch(skillProjectKey);
  if (!normalizedSkillKey) {
    return false;
  }

  const normalizedCandidates = new Set(candidateProjectKeys.map(normalizeSkillProjectKeyForMatch).filter(Boolean));
  return normalizedCandidates.has(normalizedSkillKey);
};

export const formatSkillProjectKey = (projectKey: string | null | undefined): string => {
  if (!projectKey) {
    return '';
  }

  if (projectKey.includes('__')) {
    const [encodedOrg, encodedProject] = projectKey.split('__');
    if (encodedOrg && encodedProject) {
      try {
        return `${decodeURIComponent(encodedOrg)} / ${decodeURIComponent(encodedProject)}`;
      } catch {
        // Fall through to legacy display.
      }
    }
  }

  return projectKey.replace('_', ' / ');
};
