import { ipcRenderer } from 'electron';
import type { PullRequestSummary, ReviewPromptContext, ReviewSessionOptions, ReviewWorktreeStatus } from '@shared/types/models';
import { IpcChannels } from '@shared/constants/ipcChannels';

export const reviewsApi = {
  getReviewJobs: () => ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_GET_JOBS),
  enqueueReview: (pullRequest: PullRequestSummary, prompt: string, modelName?: string | null, batchLabel?: string | null, batchPrompts?: string[], forceNewSession?: boolean, selectedSkillIds?: string[], reviewSessionOptions?: ReviewSessionOptions | null, reviewPromptContext?: ReviewPromptContext | null) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_ENQUEUE, pullRequest, prompt, modelName, batchLabel, batchPrompts, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext),
  generateSummary: (prompt: string, modelName?: string | null) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_GENERATE_SUMMARY, prompt, modelName),
  clearReviewResults: (pullRequestId?: number | null) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_CLEAR_RESULTS, pullRequestId),
  deleteReviewJob: (jobId: string) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_DELETE_JOB, jobId),
  hideFinishedReviewRuns: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_HIDE_FINISHED),
  showAllReviewRuns: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_SHOW_ALL),
  getReviewWorktreeStatus: (pullRequest: PullRequestSummary): Promise<ReviewWorktreeStatus | null> =>
    ipcRenderer.invoke(IpcChannels.REVIEW_WORKTREE_GET_STATUS, pullRequest),
  preloadReviewWorktree: (pullRequest: PullRequestSummary): Promise<ReviewWorktreeStatus | null> =>
    ipcRenderer.invoke(IpcChannels.REVIEW_WORKTREE_PRELOAD, pullRequest),
  onReviewWorktreeChanged: (handler: (status: ReviewWorktreeStatus) => void) => {
    const wrapped = (_event: unknown, payload: ReviewWorktreeStatus) => handler(payload);
    ipcRenderer.on(IpcChannels.REVIEW_WORKTREE_CHANGED, wrapped);
    return () => ipcRenderer.removeListener(IpcChannels.REVIEW_WORKTREE_CHANGED, wrapped);
  },
  onReviewQueueChanged: (handler: () => void) => {
    ipcRenderer.on(IpcChannels.REVIEW_QUEUE_CHANGED, handler);
    return () => ipcRenderer.removeListener(IpcChannels.REVIEW_QUEUE_CHANGED, handler);
  },
  cancelReview: (jobId: string) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_CANCEL, jobId),
  reloadPersistedReviews: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_QUEUE_RELOAD_PERSISTED),
  getPersistedReviewJobs: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_GET_JOBS),
  deleteAllPersistedReviews: () =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_DELETE_ALL),
  deletePersistedReviewsForPullRequest: (pullRequest: PullRequestSummary) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_DELETE_FOR_PULL_REQUEST, pullRequest),
  deletePersistedReviewJobForPullRequest: (pullRequest: PullRequestSummary, jobId: string) =>
    ipcRenderer.invoke(IpcChannels.REVIEW_STORAGE_DELETE_JOB_FOR_PULL_REQUEST, pullRequest, jobId),
  purgeOldData: (days: number): Promise<{ reviewJobs: number; followUps: number }> =>
    ipcRenderer.invoke(IpcChannels.PURGE_OLD_DATA, days)
};