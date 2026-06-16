import { preloadApi, type RendererApi } from './base';

export const skillsApi: Pick<RendererApi,
  'getSkills' |
  'getSkillFiles' |
  'syncProjectSkills' |
  'saveGlobalSkill' |
  'deleteGlobalSkill' |
  'deleteProjectSkill' |
  'toggleSkillHidden' |
  'updateSkillLinkedOrganizations' |
  'getSkillSyncStatus' |
  'resolveSkillsForReview' |
  'getSkillProjectKeys' |
  'openSkillFolder' |
  'getSkillsIntegritySummary' |
  'validateAllSkills' |
  'saveAllSkillsToDisk'
> = {
  getSkills: preloadApi.getSkills,
  getSkillFiles: preloadApi.getSkillFiles,
  syncProjectSkills: preloadApi.syncProjectSkills,
  saveGlobalSkill: preloadApi.saveGlobalSkill,
  deleteGlobalSkill: preloadApi.deleteGlobalSkill,
  deleteProjectSkill: preloadApi.deleteProjectSkill,
  toggleSkillHidden: preloadApi.toggleSkillHidden,
  updateSkillLinkedOrganizations: preloadApi.updateSkillLinkedOrganizations,
  getSkillSyncStatus: preloadApi.getSkillSyncStatus,
  resolveSkillsForReview: preloadApi.resolveSkillsForReview,
  getSkillProjectKeys: preloadApi.getSkillProjectKeys,
  openSkillFolder: preloadApi.openSkillFolder,
  getSkillsIntegritySummary: preloadApi.getSkillsIntegritySummary,
  validateAllSkills: preloadApi.validateAllSkills,
  saveAllSkillsToDisk: preloadApi.saveAllSkillsToDisk
};