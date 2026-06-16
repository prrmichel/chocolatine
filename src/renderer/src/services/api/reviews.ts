import { preloadApi, type RendererApi } from './base';

export const reviewsApi: Pick<RendererApi,
  'getReviewJobs' |
  'enqueueReview' |
  'getReviewWorktreeStatus' |
  'preloadReviewWorktree' |
  'generateSummary' |
  'clearReviewResults' |
  'deleteReviewJob' |
  'hideFinishedReviewRuns' |
  'showAllReviewRuns' |
  'cancelReview' |
  'reloadPersistedReviews' |
  'getPersistedReviewJobs' |
  'deleteAllPersistedReviews' |
  'deletePersistedReviewsForPullRequest' |
  'deletePersistedReviewJobForPullRequest' |
  'purgeOldData' |
  'onReviewQueueChanged' |
  'onReviewWorktreeChanged'
> = {
  getReviewJobs: preloadApi.getReviewJobs,
  enqueueReview: preloadApi.enqueueReview,
  getReviewWorktreeStatus: preloadApi.getReviewWorktreeStatus,
  preloadReviewWorktree: preloadApi.preloadReviewWorktree,
  generateSummary: preloadApi.generateSummary,
  clearReviewResults: preloadApi.clearReviewResults,
  deleteReviewJob: preloadApi.deleteReviewJob,
  hideFinishedReviewRuns: preloadApi.hideFinishedReviewRuns,
  showAllReviewRuns: preloadApi.showAllReviewRuns,
  cancelReview: preloadApi.cancelReview,
  reloadPersistedReviews: preloadApi.reloadPersistedReviews,
  getPersistedReviewJobs: preloadApi.getPersistedReviewJobs,
  deleteAllPersistedReviews: preloadApi.deleteAllPersistedReviews,
  deletePersistedReviewsForPullRequest: preloadApi.deletePersistedReviewsForPullRequest,
  deletePersistedReviewJobForPullRequest: preloadApi.deletePersistedReviewJobForPullRequest,
  purgeOldData: preloadApi.purgeOldData,
  onReviewQueueChanged: preloadApi.onReviewQueueChanged,
  onReviewWorktreeChanged: preloadApi.onReviewWorktreeChanged
};