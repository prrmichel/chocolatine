import { ipcRenderer } from 'electron';
import type { SkillDiskSyncResult, SkillFile, SkillInfo, SkillIntegritySummary, SkillScope, SkillSyncResult } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';

export const skillsApi = {
  getSkills: (scope?: SkillScope, projectKey?: string): Promise<SkillInfo[]> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_GET_ALL, scope, projectKey),
  getSkillFiles: (skillId: string): Promise<SkillFile[]> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_GET_FILES, skillId),
  syncProjectSkills: (orgName: string, projectName: string, repositoryId: string, repositoryName: string): Promise<SkillSyncResult> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_SYNC_PROJECT, orgName, projectName, repositoryId, repositoryName),
  saveGlobalSkill: (name: string, description: string, content: string, linkedOrganizationIds?: string[] | null, existingId?: string): Promise<SkillInfo> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_SAVE_GLOBAL, name, description, content, linkedOrganizationIds, existingId),
  deleteGlobalSkill: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_DELETE_GLOBAL, id),
  deleteProjectSkill: (id: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_DELETE_PROJECT, id),
  toggleSkillHidden: (id: string, isHidden: boolean): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_TOGGLE_HIDDEN, id, isHidden),
  updateSkillLinkedOrganizations: (id: string, linkedOrganizationIds: string[] | null): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_UPDATE_LINKED_ORGS, id, linkedOrganizationIds),
  getSkillSyncStatus: (projectKey: string): Promise<{ lastSyncedAt: string | null; repositoryName?: string }> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_GET_SYNC_STATUS, projectKey),
  resolveSkillsForReview: (projectKey: string | null, selectedGlobalSkillIds?: string[]): Promise<{ skillDirectories: string[]; disabledSkills: string[]; expectedMarkers: Array<{ skillName: string; marker: string }> }> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_RESOLVE_FOR_REVIEW, projectKey, selectedGlobalSkillIds),
  getSkillProjectKeys: (): Promise<string[]> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_GET_PROJECT_KEYS),
  openSkillFolder: (folderPath: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_OPEN_FOLDER, folderPath),
  getSkillsIntegritySummary: (): Promise<SkillIntegritySummary> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_GET_INTEGRITY_SUMMARY),
  validateAllSkills: (): Promise<SkillIntegritySummary> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_VALIDATE_ALL),
  saveAllSkillsToDisk: (): Promise<SkillDiskSyncResult> =>
    ipcRenderer.invoke(IpcChannels.SKILLS_SAVE_ALL_TO_DISK)
};