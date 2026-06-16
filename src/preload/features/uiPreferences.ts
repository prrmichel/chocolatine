import { clipboard, ipcRenderer } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { ModelInfo } from '@shared/types/models';

export const uiPreferencesApi = {
  getUIPref: (key: string): Promise<string | null> =>
    ipcRenderer.invoke(IpcChannels.UI_PREF_GET, key),
  setUIPref: (key: string, value: string | null): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.UI_PREF_SET, key, value),
  listCopilotModels: (traceId?: string): Promise<ModelInfo[]> => {
    return ipcRenderer.invoke(IpcChannels.COPILOT_LIST_MODELS, traceId ?? null);
  },
  writeToClipboard: (text: string): void => clipboard.writeText(text)
};