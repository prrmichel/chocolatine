import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerFollowUpIpc({ followUpService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.FOLLOW_UP_CREATE_CONTEXT, async (_event, job) =>
    followUpService?.createContext(job)
  );
  ipcMain.handle(IpcChannels.FOLLOW_UP_DELETE_CONTEXT, async (_event, pullRequest, contextId: string) =>
    followUpService?.deleteContext(pullRequest, contextId)
  );
  ipcMain.handle(IpcChannels.FOLLOW_UP_GET_CONTEXTS, async (_event, pullRequest) =>
    followUpService?.getContextSummaries(pullRequest) ?? []
  );
  ipcMain.handle(IpcChannels.FOLLOW_UP_GET_CONTEXT, async (_event, pullRequest, contextId: string) =>
    followUpService?.getContext(pullRequest, contextId)
  );
  ipcMain.handle(IpcChannels.FOLLOW_UP_SEND, async (_event, contextId: string, message: string, modelName?: string) =>
    followUpService?.sendMessage(contextId, message, modelName)
  );
  ipcMain.handle(IpcChannels.FOLLOW_UP_CANCEL, async (_event, contextId: string) =>
    followUpService?.cancelMessage(contextId)
  );
}