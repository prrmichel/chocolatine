import { preloadApi, type RendererApi } from './base';

export const askApi: Pick<RendererApi,
  'createAskContext' |
  'deleteAskContext' |
  'renameAskContext' |
  'getAskContexts' |
  'getAskMessages' |
  'sendAskMessage' |
  'cancelAskMessage' |
  'onAskDelta' |
  'onAskMessageComplete'
> = {
  createAskContext: preloadApi.createAskContext,
  deleteAskContext: preloadApi.deleteAskContext,
  renameAskContext: preloadApi.renameAskContext,
  getAskContexts: preloadApi.getAskContexts,
  getAskMessages: preloadApi.getAskMessages,
  sendAskMessage: preloadApi.sendAskMessage,
  cancelAskMessage: preloadApi.cancelAskMessage,
  onAskDelta: preloadApi.onAskDelta,
  onAskMessageComplete: preloadApi.onAskMessageComplete
};