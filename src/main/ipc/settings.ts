import { BrowserWindow, dialog, ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

function getDatabaseTargetFolder(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Database folder path must be a string when provided.');
  }
  const trimmedValue = value.trim();
  return trimmedValue || null;
}

export function registerSettingsIpc({ settingsStore, databaseService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.SETTINGS_GET, async () => settingsStore.getRendererSettings());
  ipcMain.handle(IpcChannels.SETTINGS_SAVE, async (_event, settings) => {
    const targetFolder = getDatabaseTargetFolder(settings?.database?.folderPath);
    const currentFolder = settingsStore.getConfiguredDatabaseFolderPath();
    if (databaseService && targetFolder !== currentFolder) {
      databaseService.relocateDatabase(targetFolder);
    }
    return settingsStore.saveSettings(settings);
  });
  ipcMain.handle(IpcChannels.SETTINGS_UPDATE, async (_event, partial) => {
    const current = settingsStore.getSettings();
    const targetFolder = getDatabaseTargetFolder(partial?.database?.folderPath ?? current.database?.folderPath ?? null);
    const currentFolder = settingsStore.getConfiguredDatabaseFolderPath();
    if (databaseService && targetFolder !== currentFolder) {
      databaseService.relocateDatabase(targetFolder);
    }
    return settingsStore.updateSettings(partial);
  });
  ipcMain.handle(IpcChannels.SETTINGS_PICK_REVIEW_STORAGE_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) {
      return null;
    }
    return result.filePaths?.[0] ?? null;
  });
  ipcMain.handle(IpcChannels.AZURE_TEST_ORG_CONNECTION, async (_event, orgName: string, pat: string) =>
    settingsStore.testOrgConnection(orgName, pat)
  );
  ipcMain.handle(IpcChannels.AZURE_TEST_STORED_ORG_CONNECTION, async (_event, orgId: string, orgName?: string) =>
    settingsStore.testStoredOrgConnection(orgId, orgName)
  );
  ipcMain.handle(IpcChannels.SETTINGS_SET_ACTIVE_PR_SOURCE, async (_event, id: string | null) => {
    settingsStore.setActivePrSource(id);
    return settingsStore.getRendererSettings();
  });
}