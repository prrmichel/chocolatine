import { preloadApi, type RendererApi } from './base';

export const settingsApi: Pick<RendererApi,
  'getSettings' |
  'saveSettings' |
  'updateSettings' |
  'pickReviewStorageFolder' |
  'testOrgConnection' |
  'testStoredOrgConnection' |
  'saveByokProvider' |
  'deleteByokProvider' |
  'testByokConnection'
> = {
  getSettings: preloadApi.getSettings,
  saveSettings: preloadApi.saveSettings,
  updateSettings: preloadApi.updateSettings,
  pickReviewStorageFolder: preloadApi.pickReviewStorageFolder,
  testOrgConnection: preloadApi.testOrgConnection,
  testStoredOrgConnection: preloadApi.testStoredOrgConnection,
  saveByokProvider: preloadApi.saveByokProvider,
  deleteByokProvider: preloadApi.deleteByokProvider,
  testByokConnection: preloadApi.testByokConnection
};