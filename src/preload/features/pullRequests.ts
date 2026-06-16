import { ipcRenderer } from 'electron';
import type { AppSettings, PullRequestStatus } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';

export const pullRequestsApi = {
  getPullRequests: (status: PullRequestStatus, creatorId?: string) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUESTS, status, creatorId),
  testAdoConnection: (overrideSettings?: Partial<{ organization: string; project: string; pat: string }>) =>
    ipcRenderer.invoke(IpcChannels.AZURE_TEST_CONNECTION, overrideSettings),
  setActivePrSource: (id: string | null): Promise<AppSettings> =>
    ipcRenderer.invoke(IpcChannels.SETTINGS_SET_ACTIVE_PR_SOURCE, id),
  getPullRequestDetails: (id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUEST_DETAILS, id),
  getPullRequestWorkItems: (repositoryId: string, id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUEST_WORK_ITEMS, repositoryId, id),
  getPullRequestDiffs: (id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUEST_DIFFS, id),
  getPullRequestFileChanges: (id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUEST_FILE_CHANGES, id),
  getSingleFileDiff: (pullRequestId: number, filePath: string) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_SINGLE_FILE_DIFF, pullRequestId, filePath),
  getFullFileDiff: (pullRequestId: number, filePath: string): Promise<string> =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_FULL_FILE_DIFF, pullRequestId, filePath),
  getRepositories: (sourceId?: string | null): Promise<Array<{ id: string; name: string; defaultBranch?: string }>> =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_REPOSITORIES, sourceId),
  getPullRequestThreads: (repositoryId: string, id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_GET_PULL_REQUEST_THREADS, repositoryId, id),
  assignReviewerToPullRequest: (repositoryId: string, id: number) =>
    ipcRenderer.invoke(IpcChannels.AZURE_ASSIGN_REVIEWER_TO_PULL_REQUEST, repositoryId, id)
};