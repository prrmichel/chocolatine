import { preloadApi, type RendererApi } from './base';

export const uiPreferencesApi: Pick<RendererApi,
  'getUIPref' |
  'setUIPref' |
  'listCopilotModels' |
  'writeToClipboard'
> = {
  getUIPref: preloadApi.getUIPref,
  setUIPref: preloadApi.setUIPref,
  listCopilotModels: preloadApi.listCopilotModels,
  writeToClipboard: preloadApi.writeToClipboard
};