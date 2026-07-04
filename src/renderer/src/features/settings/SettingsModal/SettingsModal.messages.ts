/** User-facing labels for SettingsModal */

export const LABELS = {
  heading: 'Settings',
  tabAdo: 'Azure DevOps',
  tabByok: 'AI Providers',
  tabPreferences: 'Preferences',
  tabData: 'Data',
  // Organizations
  organizationsHeading: 'Organizations',
  addOrganization: 'Add organization',
  orgName: 'Organization name',
  orgPat: 'Personal Access Token',
  orgPatRequired: 'A PAT is required for a new organization.',
  orgPatKeepStored: 'Leave blank to keep the stored PAT.',
  orgPatReplaceStored: 'Enter a new PAT to replace the stored one.',
  orgPatMissingStored: 'This organization does not have a stored PAT yet.',
  orgTokenLink: 'Create a token (min. scopes: Work Items - Read, Code - Read)',
  testOrgConnection: 'Test',
  testingOrgConnection: 'Testing…',
  storedPatLabel: 'Stored PAT',
  missingPatLabel: 'PAT required',
  // PR Sources
  prSourcesHeading: 'PR Sources',
  addPrSource: 'Add PR source',
  prSourceName: 'Name',
  prSourceOrganization: 'Organization',
  prSourceProject: 'Project',
  prSourceRepository: 'Repository (optional)',
  prSourceSelectOrg: '— Select organization —',
  prSourceNameRequired: 'Name, organization and project are required.',
  // Legacy fields (kept for compat)
  organization: 'Organization',
  project: 'Project',
  pat: 'Personal Access Token',
  displayName: 'My ADO display name',
  displayNamePlaceholder: 'e.g. John Doe',
  displayNameHelper: 'Used for the "Assigned to me" filter in the PR list.',
  testingConnection: 'Testing…',
  testConnection: 'Test connection',
  adoHelper: 'Azure DevOps settings are saved in a local config file.',
  maxConcurrentReviews: 'Max concurrent reviews',
  defaultModel: 'Default model',
  modelCatalogUnavailable: 'Copilot model catalog is unavailable. Default model cannot be selected right now.',
  defaultDiffViewMode: 'Default diff view mode',
  reviewWorktreeRootFolder: 'Review worktree root folder',
  reviewWorktreeRootFolderHint: 'Required for standard branch-aware review. Chocolatine manages mirrors and review worktrees under this root.',
  reviewWorktreeRootFolderPlaceholder: 'Required for branch-aware review',
  diffInline: 'Inline',
  diffSideBySide: 'Side by side',
  dataHelper:
    'Reviews, follow-ups and prompts are stored in a local SQLite database.',
  dbFolder: 'SQLite database folder',
  dbFolderPlaceholder: 'Default: app user data folder',
  browse: 'Browse…',
  dbFolderHelper:
    'When you change the database folder, the app tries to move the existing database file automatically.',
  purgeByAge: 'Purge by age:',
  purge1Month: '> 1 month',
  purge1MonthTitle: 'Delete reviews and follow-ups older than 1 month',
  purge3Months: '> 3 months',
  purge3MonthsTitle: 'Delete reviews and follow-ups older than 3 months',
  bulkDelete: 'Bulk delete:',
  deleteCompletedPR: 'Delete completed PR reviews',
  deleteCompletedPRTitle:
    'Deletes review and follow-up data for PRs returned by the Azure DevOps \'completed\' list',
  deleteAllData: 'Delete all data',
  confirmDeleteAllTitle: 'Delete all data',
  confirmDeleteAllMessage:
    'Delete ALL persisted reviews and follow-up data from the database?',
  confirmDeleteCompletedTitle: 'Delete completed PR data',
  confirmDeleteCompletedMessage:
    'Delete persisted reviews and follow-up data for ALL completed pull requests?',
  confirmPurgeTitle: 'Purge old data',
  purgeFailed: 'Purge failed.',
  partialSaveTitle: 'Some Azure DevOps changes were not saved.',
  deleteOrganizationTitle: 'Delete organization',
  deleteOrganizationAndSourcesTitle: 'Delete organization and PR sources',
  deleteOrganizationAndSourcesConfirm: 'Delete organization and sources',
  saving: 'Saving…',
  cancel: 'Cancel',
  save: 'Save',
  confirmDelete: 'Delete',
} as const;

export const confirmPurgeMessage = (label: string): string =>
  `Delete all reviews and follow-ups older than ${label}?`;

export const purgeResultMessage = (reviews: number, followUps: number): string =>
  `Purged ${reviews} reviews and ${followUps} follow-ups.`;

export const buildDeleteOrganizationMessage = (organizationName: string): string =>
  `Delete "${organizationName}"?`;

export const buildDeleteOrganizationCascadeMessage = (
  organizationName: string,
  sourceNames: string[]
): string => {
  const label = sourceNames.length === 1 ? 'PR source' : 'PR sources';
  return `Deleting "${organizationName}" will also delete ${sourceNames.length} dependent ${label}: ${sourceNames.join(', ')}.`;
};

export const BYOK_DELETE_LABELS = {
  title: 'Delete provider',
  confirm: 'Delete'
} as const;

export const buildDeleteByokProviderMessage = (label: string): string =>
  `Delete the AI provider "${label}" and its stored API key?`;
