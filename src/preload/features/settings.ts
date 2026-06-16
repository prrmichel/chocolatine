import { ipcRenderer } from 'electron';
import type { AppSettings, SettingsSaveResult } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';

export const settingsApi = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IpcChannels.SETTINGS_GET),
  saveSettings: (settings: AppSettings): Promise<SettingsSaveResult> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SAVE, settings),
  updateSettings: (partial: Partial<AppSettings>): Promise<SettingsSaveResult> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_UPDATE, partial),
  pickReviewStorageFolder: (): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_PICK_REVIEW_STORAGE_FOLDER),
  testOrgConnection: (orgName: string, pat: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke(IpcChannels.AZURE_TEST_ORG_CONNECTION, orgName, pat),
  testStoredOrgConnection: (orgId: string, orgName?: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke(IpcChannels.AZURE_TEST_STORED_ORG_CONNECTION, orgId, orgName)
};