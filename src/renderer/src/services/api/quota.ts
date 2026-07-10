import { preloadApi, type RendererApi } from './base';

export const quotaApi: Pick<RendererApi, 'getCopilotQuota'> = {
  getCopilotQuota: preloadApi.getCopilotQuota
};
