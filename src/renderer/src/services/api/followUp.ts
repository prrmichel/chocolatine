import { preloadApi, type RendererApi } from './base';

export const followUpApi: Pick<RendererApi,
  'createFollowUpContext' |
  'deleteFollowUpContext' |
  'getFollowUpContexts' |
  'getFollowUpContext' |
  'sendFollowUpMessage' |
  'cancelFollowUpMessage' |
  'onFollowUpDelta' |
  'onFollowUpMessageComplete'
> = {
  createFollowUpContext: preloadApi.createFollowUpContext,
  deleteFollowUpContext: preloadApi.deleteFollowUpContext,
  getFollowUpContexts: preloadApi.getFollowUpContexts,
  getFollowUpContext: preloadApi.getFollowUpContext,
  sendFollowUpMessage: preloadApi.sendFollowUpMessage,
  cancelFollowUpMessage: preloadApi.cancelFollowUpMessage,
  onFollowUpDelta: preloadApi.onFollowUpDelta,
  onFollowUpMessageComplete: preloadApi.onFollowUpMessageComplete
};