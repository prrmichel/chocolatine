import { ipcRenderer, type IpcRendererEvent } from 'electron';

export function onIpcPayload<T>(channel: string, handler: (payload: T) => void) {
  const listener = (_event: IpcRendererEvent, payload: T) => handler(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}