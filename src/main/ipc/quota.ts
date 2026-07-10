import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerQuotaIpc({ copilotSessionManager }: MainIpcServices) {
  ipcMain.handle(IpcChannels.COPILOT_GET_QUOTA, async () => {
    if (!copilotSessionManager) {
      return { quotaSnapshots: {} };
    }
    return copilotSessionManager.getQuota();
  });
}
