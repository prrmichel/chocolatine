import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import type { MainIpcServices } from '@main/ipc/types';

export function registerPullRequestsIpc({ azureDevOpsService, changesService, settingsStore }: MainIpcServices) {
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUESTS, async (_event, status, creatorId?: string) =>
    azureDevOpsService.getPullRequests(status, creatorId)
  );
  ipcMain.handle(IpcChannels.AZURE_TEST_CONNECTION, async (_event, overrideSettings) =>
    azureDevOpsService.testConnection(overrideSettings)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_DETAILS, async (_event, id) =>
    azureDevOpsService.getPullRequestDetails(id)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_WORK_ITEMS, async (_event, repositoryId, id) =>
    azureDevOpsService.getPullRequestWorkItems(repositoryId, id)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_DIFFS, async (_event, id) =>
    changesService.getPullRequestFileDiffs(id)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_FILE_CHANGES, async (_event, id) =>
    changesService.getPullRequestFileChanges(id)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_SINGLE_FILE_DIFF, async (_event, pullRequestId: number, filePath: string) =>
    changesService.getSingleFileDiff(pullRequestId, filePath)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_FULL_FILE_DIFF, async (_event, pullRequestId: number, filePath: string) =>
    changesService.getFullFileDiff(pullRequestId, filePath)
  );
  ipcMain.handle(IpcChannels.AZURE_GET_REPOSITORIES, async (_event, sourceId?: string | null) => {
    const runtime = settingsStore.getAzureDevOpsRuntimeAccess(sourceId ?? null);
    return azureDevOpsService.getRepositories(runtime.settings);
  });
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_THREADS, async (_event, repositoryId, id) =>
    azureDevOpsService.getPullRequestThreads(repositoryId, id)
  );
  ipcMain.handle(IpcChannels.AZURE_ASSIGN_REVIEWER_TO_PULL_REQUEST, async (_event, repositoryId, id) =>
    azureDevOpsService.assignReviewerToPullRequest(repositoryId, id)
  );
}