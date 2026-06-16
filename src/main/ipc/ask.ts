import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerAskIpc({ askService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.ASK_CREATE_CONTEXT, async (_event, name?: string, modelName?: string) =>
    askService?.createContext(name, modelName)
  );
  ipcMain.handle(IpcChannels.ASK_DELETE_CONTEXT, async (_event, contextId: string) =>
    askService?.deleteContext(contextId)
  );
  ipcMain.handle(IpcChannels.ASK_RENAME_CONTEXT, async (_event, contextId: string, name: string) =>
    askService?.renameContext(contextId, name)
  );
  ipcMain.handle(IpcChannels.ASK_GET_CONTEXTS, async () => askService?.getContexts() ?? []);
  ipcMain.handle(IpcChannels.ASK_GET_MESSAGES, async (_event, contextId: string) =>
    askService?.getMessages(contextId) ?? []
  );
  ipcMain.handle(IpcChannels.ASK_SEND, async (_event, contextId: string, message: string, modelName?: string) =>
    askService?.sendMessage(contextId, message, modelName)
  );
  ipcMain.handle(IpcChannels.ASK_CANCEL, async (_event, contextId: string) =>
    askService?.cancelMessage(contextId)
  );
}