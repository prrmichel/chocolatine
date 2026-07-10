import { ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { CopilotQuotaData } from '@shared/types/quota';

export const quotaApi = {
  getCopilotQuota: () =>
    ipcRenderer.invoke(IpcChannels.COPILOT_GET_QUOTA) as Promise<CopilotQuotaData>
};
