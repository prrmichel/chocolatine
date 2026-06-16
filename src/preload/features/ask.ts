import { ipcRenderer } from 'electron';
import type { AskContext, AskMessage } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { onIpcPayload } from '@preload/features/events';

export const askApi = {
  createAskContext: (name?: string, modelName?: string): Promise<AskContext> =>
    ipcRenderer.invoke(IpcChannels.ASK_CREATE_CONTEXT, name, modelName),
  deleteAskContext: (contextId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ASK_DELETE_CONTEXT, contextId),
  renameAskContext: (contextId: string, name: string): Promise<AskContext | null> =>
    ipcRenderer.invoke(IpcChannels.ASK_RENAME_CONTEXT, contextId, name),
  getAskContexts: (): Promise<AskContext[]> =>
    ipcRenderer.invoke(IpcChannels.ASK_GET_CONTEXTS),
  getAskMessages: (contextId: string): Promise<AskMessage[]> =>
    ipcRenderer.invoke(IpcChannels.ASK_GET_MESSAGES, contextId),
  sendAskMessage: (contextId: string, message: string, modelName?: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.ASK_SEND, contextId, message, modelName),
  cancelAskMessage: (contextId: string): Promise<void> =>
    ipcRenderer.invoke(IpcChannels.ASK_CANCEL, contextId),
  onAskDelta: (handler: (payload: { contextId: string; delta: string; fullText: string }) => void) =>
    onIpcPayload(IpcChannels.ASK_DELTA, handler),
  onAskMessageComplete: (handler: (payload: { contextId: string }) => void) =>
    onIpcPayload(IpcChannels.ASK_MESSAGE_COMPLETE, handler)
};