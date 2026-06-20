import { preloadApi, type RendererApi } from './base';

export const pullRequestsApi: Pick<RendererApi,
  'getPullRequests' |
  'testAdoConnection' |
  'setActivePrSource' |
  'getPullRequestDetails' |
  'getPullRequestWorkItems' |
  'getPullRequestDiffs' |
  'getPullRequestFileChanges' |
  'getSingleFileDiff' |
  'getFullFileDiff' |
  'getRepositories' |
  'getPullRequestThreads' |
  'createPullRequestThread' |
  'updatePullRequestThreadStatus' |
  'assignReviewerToPullRequest'
> = {
  getPullRequests: preloadApi.getPullRequests,
  testAdoConnection: preloadApi.testAdoConnection,
  setActivePrSource: preloadApi.setActivePrSource,
  getPullRequestDetails: preloadApi.getPullRequestDetails,
  getPullRequestWorkItems: preloadApi.getPullRequestWorkItems,
  getPullRequestDiffs: preloadApi.getPullRequestDiffs,
  getPullRequestFileChanges: preloadApi.getPullRequestFileChanges,
  getSingleFileDiff: preloadApi.getSingleFileDiff,
  getFullFileDiff: preloadApi.getFullFileDiff,
  getRepositories: (sourceId?: string | null) => preloadApi.getRepositories(sourceId),
  getPullRequestThreads: preloadApi.getPullRequestThreads,
  createPullRequestThread: preloadApi.createPullRequestThread,
  updatePullRequestThreadStatus: preloadApi.updatePullRequestThreadStatus,
  assignReviewerToPullRequest: preloadApi.assignReviewerToPullRequest
};