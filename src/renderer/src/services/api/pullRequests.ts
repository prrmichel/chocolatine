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
  assignReviewerToPullRequest: preloadApi.assignReviewerToPullRequest
};