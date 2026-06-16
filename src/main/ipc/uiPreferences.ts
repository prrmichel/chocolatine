import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerUiPreferencesIpc({ databaseService, copilotSessionManager }: MainIpcServices) {
  ipcMain.handle(IpcChannels.UI_PREF_GET, async (_event, key: string) =>
    databaseService?.getPreference(key) ?? null
  );
  ipcMain.handle(IpcChannels.UI_PREF_SET, async (_event, key: string, value: string | null) => {
    databaseService?.setPreference(key, value);
  });
  ipcMain.handle(IpcChannels.COPILOT_LIST_MODELS, async (_event, traceId?: string | null) => {
    const resolvedTraceId = traceId?.trim() || 'none';
    if (!copilotSessionManager) {
      console.warn(`[ipc][models] No CopilotSessionManager available (traceId=${resolvedTraceId})`);
      return [];
    }
    const models = await copilotSessionManager.listModels(resolvedTraceId);
    return models;
  });
}