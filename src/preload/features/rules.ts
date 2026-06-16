import { ipcRenderer } from 'electron';
import type { PromptCategory, PromptLibrarySettings } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';

export const rulesApi = {
  getPromptLibrary: (): Promise<PromptLibrarySettings> =>
    ipcRenderer.invoke(IpcChannels.PROMPT_LIBRARY_GET),
  savePromptLibrary: (settings: PromptLibrarySettings): Promise<PromptLibrarySettings> =>
    ipcRenderer.invoke(IpcChannels.PROMPT_LIBRARY_SAVE, settings),
  addPrompt: (category?: PromptCategory): Promise<PromptLibrarySettings> =>
    ipcRenderer.invoke(IpcChannels.PROMPT_LIBRARY_ADD, category),
  removePrompt: (id: string): Promise<PromptLibrarySettings> =>
    ipcRenderer.invoke(IpcChannels.PROMPT_LIBRARY_REMOVE, id),
  loadWorkItemsSummaryInstructions: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_LOAD_WORK_ITEMS_SUMMARY_INSTRUCTIONS),
  saveWorkItemsSummaryInstructions: (value: string) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_SAVE_WORK_ITEMS_SUMMARY_INSTRUCTIONS, value)
};