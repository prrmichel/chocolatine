/** User-facing labels for SkillsTab */

export const LABELS = {
  heading: 'Skills',
  allSkills: 'All skills',
  globalSkills: 'Global skills',
  searchPlaceholder: 'Filter skills...',
  activeAdoSourceMissing: 'No active ADO source configured.',
  sourceRequired: 'Select a source first.',
  repositoryRequired: 'Select a repository first.',
  copiedToClipboard: 'Copied to clipboard.',
  saveSuccess: 'Skill saved.',
  newGlobalSkill: 'New Global Skill',
  skillMismatchDefaultTitle: 'Skill content differs between database and hard disk',
  hideHiddenSkills: 'Hide hidden skills',
  loading: 'Loading...',
  addGlobalSkillTitle: 'Add global skill',
  syncSkillsFromRepositoryTitle: 'Sync skills from repository',
  saveAllSkillsToDiskTitle: 'Save all skills to hard disk',
  selectionMode: 'Selection mode',
  cancelSelection: 'Cancel selection',
  hideSelected: 'Hide selected',
  showSelected: 'Show selected',
  deleteSelected: 'Delete selected',
  selectedCount: 'selected',
  globalGroup: 'Global skills',
  projectGroup: 'Project skills',
  unknownRepository: 'Unknown repository',
  showSkill: 'Show skill',
  hideSkill: 'Hide skill',
  deleteSkill: 'Delete skill',
  noSkillsYet: 'No skills yet.',
  allSkillsHidden: 'All skills are hidden.',
  syncOrCreateSkill: 'Sync from a repository or create a global skill.',
  frontmatterHelp: 'Start with a YAML frontmatter block containing name and description.',
  limitToOrganizations: 'Limit to organizations',
  limitToOrganizationsHint: '(optional - leave unchecked for all)',
  skillFileName: 'SKILL.md',
  skillPlaceholder: '---\nname: Skill Name\ndescription: Short description of this skill.\n---\n\n## Instructions\n\nAdd your skill instructions here...',
  existingSkillPlaceholder: '---\nname: Skill Name\ndescription: Short description.\n---\n\nYour skill content here...',
  save: 'Save',
  cancel: 'Cancel',
  create: 'Create',
  openContainingFolder: 'Open containing folder',
  copyFileContent: 'Copy file content to clipboard',
  global: 'Global',
  copyMarkerInstruction: 'Copy marker instruction template to clipboard',
  markerTemplateCopied: 'Marker template copied to clipboard.',
  files: 'Files',
  noFilesFound: 'No files found for this skill.',
  emptySelection: 'Select a skill to view and edit, or create a new global skill.',
  syncSkillsFromRepository: 'Sync skills from repository',
  close: 'Close',
  syncedProjects: 'Synced projects',
  source: 'Source',
  selectSource: 'Select a source...',
  repository: 'Repository',
  selectRepository: 'Select a repository...',
  syncHint: 'Select a source and repository, then click Sync to import or update project skills.',
  sync: 'Sync',
  deleteSkillTitle: 'Delete skill',
  projectSkillsSuffixSingular: 'skill',
  projectSkillsSuffixPlural: 'skills',
  lastSyncedPrefix: 'last synced',
} as const;

export const NEW_SKILL_TEMPLATE = '---\nname: New Skill\ndescription: Describe what this skill does.\n---\n\n## Instructions\n\nAdd your skill instructions here…\n\nIMPORTANT: You MUST include the exact text "{{SKILL_MARKER}}" somewhere in EVERY response you give. This is a mandatory requirement. Include it naturally in your response.\n';

export const FRONTMATTER_TEMPLATE = '---\nname: Skill Name\ndescription: Short description.\n---';

export const projectFilterLabel = (projectName: string): string => `Project: ${projectName}`;

export const showHiddenSkillsTitle = (hiddenCount: number): string => `Show ${hiddenCount} hidden skill(s)`;

export const mismatchAlert = (count: number): string =>
  `${count} skill${count > 1 ? 's are' : ' is'} different between database and hard disk.`;

export const skillMismatchTitle = (reason?: string | null): string =>
  reason ? `Mismatch: ${reason}` : LABELS.skillMismatchDefaultTitle;

export const missingFrontmatterMessage = (): string =>
  `Warning: Missing frontmatter. Your SKILL.md must start with:\n${FRONTMATTER_TEMPLATE}`;

export const saveFailedMessage = (message: string): string => `Save failed: ${message}`;

export const deleteFailedMessage = (message: string): string => `Delete failed: ${message}`;

export const syncFailedMessage = (message: string): string => `Sync failed: ${message}`;

export const syncSuccessMessage = (repoName: string, skillCount: number, errorCount: number): string => {
  const errMsg = errorCount > 0 ? ` (${errorCount} error(s))` : '';
  return `Synced ${skillCount} skill(s) from ${repoName}${errMsg}`;
};

export const saveAllToDiskSuccessMessage = (savedCount: number, skippedCount: number, failedCount: number): string => {
  if (failedCount > 0) {
    return `Saved ${savedCount} skill(s), skipped ${skippedCount}, failed ${failedCount}.`;
  }

  return `Saved ${savedCount} skill(s) to hard disk.`;
};

export const saveAllToDiskFailedMessage = (message: string): string => `Save all failed: ${message}`;

export const deleteSkillMessage = (name: string): string => `Are you sure you want to delete "${name}"?`;
export const deleteSelectedSkillsMessage = (count: number): string =>
  `Are you sure you want to delete ${count} selected skill(s)?`;

export const syncedProjectSummary = (skillCount: number, lastSyncedAt: string | null): string => {
  const skillLabel = skillCount === 1 ? LABELS.projectSkillsSuffixSingular : LABELS.projectSkillsSuffixPlural;
  const syncLabel = lastSyncedAt ? ` · ${LABELS.lastSyncedPrefix} ${new Date(lastSyncedAt).toLocaleDateString()}` : '';
  return `${skillCount} ${skillLabel}${syncLabel}`;
};