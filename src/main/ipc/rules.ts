import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerRulesIpc({ promptLibraryService, reviewStorageService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_GET, async () => promptLibraryService.load());
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_SAVE, async (_event, settings) =>
    promptLibraryService.saveSettings(settings)
  );
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_ADD, async (_event, category) =>
    promptLibraryService.addPrompt(category)
  );
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_REMOVE, async (_event, id: string) =>
    promptLibraryService.removePrompt(id)
  );
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_LOAD_WORK_ITEMS_SUMMARY_INSTRUCTIONS, async () =>
    reviewStorageService?.loadWorkItemsSummaryInstructions() ?? ''
  );
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_SAVE_WORK_ITEMS_SUMMARY_INSTRUCTIONS, async (_event, value: string) => {
    await reviewStorageService?.saveWorkItemsSummaryInstructions(value ?? '');
  });
}