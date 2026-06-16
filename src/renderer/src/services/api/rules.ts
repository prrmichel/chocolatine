import { preloadApi, type RendererApi } from './base';

export const rulesApi: Pick<RendererApi,
  'getPromptLibrary' |
  'savePromptLibrary' |
  'addPrompt' |
  'removePrompt' |
  'loadWorkItemsSummaryInstructions' |
  'saveWorkItemsSummaryInstructions'
> = {
  getPromptLibrary: preloadApi.getPromptLibrary,
  savePromptLibrary: preloadApi.savePromptLibrary,
  addPrompt: preloadApi.addPrompt,
  removePrompt: preloadApi.removePrompt,
  loadWorkItemsSummaryInstructions: preloadApi.loadWorkItemsSummaryInstructions,
  saveWorkItemsSummaryInstructions: preloadApi.saveWorkItemsSummaryInstructions
};