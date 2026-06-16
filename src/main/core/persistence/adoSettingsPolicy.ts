import type {
  AdoOrganization,
  AdoOrganizationMetadata,
  PrSource,
  SettingsSaveIssue
} from '../../../shared/types/settings';

export interface ApplyAdoSettingsPolicyInput {
  currentOrganizations: AdoOrganizationMetadata[];
  currentOrganizationTokens: Record<string, string>;
  currentPrSources: PrSource[];
  requestedOrganizations: AdoOrganization[];
  requestedPrSources: PrSource[];
  requestedActivePrSourceId: string | null;
  protectedStorageAvailable: boolean;
}

export interface ApplyAdoSettingsPolicyResult {
  organizations: AdoOrganizationMetadata[];
  organizationTokens: Record<string, string>;
  prSources: PrSource[];
  activePrSourceId: string | null;
  issues: SettingsSaveIssue[];
  message: string | null;
}

function samePrSource(left: PrSource, right: PrSource): boolean {
  return left.id === right.id
    && left.name === right.name
    && left.organizationId === right.organizationId
    && left.project === right.project
    && (left.repository ?? null) === (right.repository ?? null);
}

function normalizePrSource(source: PrSource): PrSource {
  return {
    id: source.id,
    name: source.name.trim(),
    organizationId: source.organizationId,
    project: source.project.trim(),
    repository: source.repository?.trim() ? source.repository.trim() : null
  };
}

function buildPartialSaveMessage(issues: SettingsSaveIssue[]): string | null {
  if (issues.length === 0) {
    return null;
  }

  const orgCount = issues.filter((issue) => issue.scope === 'organization').length;
  const sourceCount = issues.filter((issue) => issue.scope === 'prSource').length;
  const parts: string[] = [];

  if (orgCount > 0) {
    parts.push(`${orgCount} Azure DevOps organization${orgCount === 1 ? '' : 's'} not saved`);
  }
  if (sourceCount > 0) {
    parts.push(`${sourceCount} PR source${sourceCount === 1 ? '' : 's'} not saved`);
  }

  return `Settings were only partially saved: ${parts.join(' and ')}.`;
}

export function applyAdoSettingsPolicy(input: ApplyAdoSettingsPolicyInput): ApplyAdoSettingsPolicyResult {
  const currentOrganizationsById = new Map(input.currentOrganizations.map((org) => [org.id, org]));
  const currentPrSourcesById = new Map(input.currentPrSources.map((source) => [source.id, source]));

  const acceptedOrganizationsById = new Map<string, AdoOrganizationMetadata>();
  const acceptedOrganizationTokens: Record<string, string> = {};
  const failedOrganizationIds = new Set<string>();
  const issues: SettingsSaveIssue[] = [];

  const acceptCurrentOrganization = (orgId: string) => {
    const currentOrganization = currentOrganizationsById.get(orgId);
    if (!currentOrganization) {
      return;
    }
    acceptedOrganizationsById.set(orgId, currentOrganization);
    acceptedOrganizationTokens[orgId] = input.currentOrganizationTokens[orgId] ?? '';
  };

  for (const requestedOrganization of input.requestedOrganizations) {
    const name = requestedOrganization.name.trim();
    const pat = requestedOrganization.pat.trim();
    const currentOrganization = currentOrganizationsById.get(requestedOrganization.id);
    const currentToken = input.currentOrganizationTokens[requestedOrganization.id] ?? '';
    const isExisting = Boolean(currentOrganization);

    if (!name) {
      issues.push({
        code: 'invalid-organization',
        scope: 'organization',
        entityId: requestedOrganization.id,
        message: 'Organization name is required.'
      });
      if (isExisting) {
        acceptCurrentOrganization(requestedOrganization.id);
      }
      continue;
    }

    if (!isExisting && !pat) {
      issues.push({
        code: 'pat-required',
        scope: 'organization',
        entityId: requestedOrganization.id,
        message: 'A new Azure DevOps organization requires a PAT.'
      });
      continue;
    }

    if (pat && !input.protectedStorageAvailable) {
      issues.push({
        code: 'protected-storage-unavailable',
        scope: 'organization',
        entityId: requestedOrganization.id,
        message: 'Protected storage is unavailable, so this PAT could not be saved.'
      });
      failedOrganizationIds.add(requestedOrganization.id);
      if (isExisting) {
        acceptCurrentOrganization(requestedOrganization.id);
      }
      continue;
    }

    acceptedOrganizationsById.set(requestedOrganization.id, {
      id: requestedOrganization.id,
      name
    });
    acceptedOrganizationTokens[requestedOrganization.id] = pat || currentToken;
  }

  const acceptedOrganizationIds = new Set(acceptedOrganizationsById.keys());
  const acceptedPrSourcesById = new Map<string, PrSource>();

  for (const requestedSource of input.requestedPrSources) {
    const normalizedSource = normalizePrSource(requestedSource);
    const currentSource = currentPrSourcesById.get(normalizedSource.id);
    const isChanged = !currentSource || !samePrSource(currentSource, normalizedSource);

    if (!normalizedSource.name || !normalizedSource.project || !normalizedSource.organizationId) {
      issues.push({
        code: 'invalid-pr-source',
        scope: 'prSource',
        entityId: normalizedSource.id,
        message: 'PR source name, organization, and project are required.'
      });
      if (currentSource && acceptedOrganizationIds.has(currentSource.organizationId)) {
        acceptedPrSourcesById.set(currentSource.id, currentSource);
      }
      continue;
    }

    if (!acceptedOrganizationIds.has(normalizedSource.organizationId)) {
      if (isChanged) {
        issues.push({
          code: 'dependent-pr-source-rejected',
          scope: 'prSource',
          entityId: normalizedSource.id,
          message: 'This PR source was not saved because its Azure DevOps organization was not saved.'
        });
      }

      if (currentSource && acceptedOrganizationIds.has(currentSource.organizationId)) {
        acceptedPrSourcesById.set(currentSource.id, currentSource);
      }
      continue;
    }

    acceptedPrSourcesById.set(normalizedSource.id, normalizedSource);
  }

  const prSources = Array.from(acceptedPrSourcesById.values())
    .sort((left, right) => left.name.localeCompare(right.name));

  const requestedActivePrSourceId = input.requestedActivePrSourceId?.trim() || null;
  const hasRequestedActivePrSource = requestedActivePrSourceId
    ? prSources.some((source) => source.id === requestedActivePrSourceId)
    : false;

  const activePrSourceId = hasRequestedActivePrSource
    ? requestedActivePrSourceId
    : prSources.length === 1
      ? prSources[0].id
      : null;

  const organizations = Array.from(acceptedOrganizationsById.values())
    .sort((left, right) => left.name.localeCompare(right.name));

  return {
    organizations,
    organizationTokens: acceptedOrganizationTokens,
    prSources,
    activePrSourceId,
    issues,
    message: buildPartialSaveMessage(issues)
  };
}
