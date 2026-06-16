import { ipcMain, shell } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerSkillsIpc({ skillsService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.SKILLS_GET_ALL, async (_event, scope?: string, projectKey?: string) =>
    skillsService?.getAll(scope as any, projectKey) ?? []
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_FILES, async (_event, skillId: string) =>
    skillsService?.getSkillFiles(skillId) ?? []
  );
  ipcMain.handle(
    IpcChannels.SKILLS_SYNC_PROJECT,
    async (_event, orgName: string, projectName: string, repositoryId: string, repositoryName: string) =>
      skillsService?.syncProjectSkills(orgName, projectName, repositoryId, repositoryName)
  );
  ipcMain.handle(IpcChannels.SKILLS_SAVE_GLOBAL, async (_event, name: string, description: string, content: string, linkedOrganizationIds?: string[] | null, existingId?: string) =>
    skillsService?.saveGlobalSkill(name, description, content, linkedOrganizationIds, existingId)
  );
  ipcMain.handle(IpcChannels.SKILLS_DELETE_GLOBAL, async (_event, id: string) =>
    skillsService?.deleteGlobalSkill(id)
  );
  ipcMain.handle(IpcChannels.SKILLS_DELETE_PROJECT, async (_event, id: string) =>
    skillsService?.deleteProjectSkill(id)
  );
  ipcMain.handle(IpcChannels.SKILLS_TOGGLE_HIDDEN, async (_event, id: string, isHidden: boolean) =>
    skillsService?.toggleSkillHidden(id, isHidden)
  );
  ipcMain.handle(IpcChannels.SKILLS_UPDATE_LINKED_ORGS, async (_event, id: string, linkedOrganizationIds: string[] | null) =>
    skillsService?.updateSkillLinkedOrganizations(id, linkedOrganizationIds)
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_SYNC_STATUS, async (_event, projectKey: string) =>
    skillsService?.getSyncStatus(projectKey) ?? { lastSyncedAt: null }
  );
  ipcMain.handle(
    IpcChannels.SKILLS_RESOLVE_FOR_REVIEW,
    async (_event, projectKey: string | null, selectedGlobalSkillIds?: string[]) =>
      skillsService?.resolveSkillsForReview(projectKey, null, selectedGlobalSkillIds) ?? { skillDirectories: [], disabledSkills: [], expectedMarkers: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_PROJECT_KEYS, async () =>
    skillsService?.getProjectKeys() ?? []
  );
  ipcMain.handle(IpcChannels.SKILLS_OPEN_FOLDER, async (_event, folderPath: string) => {
    if (folderPath) {
      await shell.openPath(folderPath);
    }
  });
  ipcMain.handle(IpcChannels.SKILLS_GET_INTEGRITY_SUMMARY, async () =>
    skillsService?.getIntegritySummary() ?? { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_VALIDATE_ALL, async () =>
    skillsService?.validateAllSkillsIntegrity() ?? { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_SAVE_ALL_TO_DISK, async () =>
    skillsService?.saveAllSkillsToDisk() ?? {
      savedCount: 0,
      skippedCount: 0,
      failed: [],
      summary: { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
    }
  );
}