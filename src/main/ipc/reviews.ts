import { ipcMain } from 'electron';
import { IpcChannels } from '@shared/constants/ipcChannels';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import type { MainIpcServices } from '@main/ipc/types';

export function registerReviewsIpc({ reviewQueueService, reviewStorageService, followUpService, databaseService, copilotSessionManager, reviewWorktreeService }: MainIpcServices) {
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_GET_JOBS, async () => reviewQueueService.getJobs());
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_ENQUEUE, async (_event, pullRequest, prompt, modelName, batchLabel, batchPrompts, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext) =>
    reviewQueueService.enqueueReview(pullRequest, prompt, modelName, batchLabel, batchPrompts, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext)
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_GENERATE_SUMMARY, async (_event, prompt, modelName) =>
    reviewQueueService.generateSummary(prompt, modelName)
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_CLEAR_RESULTS, async (_event, pullRequestId?: number | null) =>
    reviewQueueService.clearResults(pullRequestId)
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_DELETE_JOB, async (_event, jobId: string) =>
    reviewQueueService.deleteJob(jobId)
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_CANCEL, async (_event, jobId: string) =>
    reviewQueueService.cancelJob(jobId)
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_RELOAD_PERSISTED, async () =>
    reviewQueueService.reloadPersisted()
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_HIDE_FINISHED, async () =>
    reviewQueueService.hideFinishedInQueue()
  );
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_SHOW_ALL, async () =>
    reviewQueueService.showAllInQueue()
  );
  ipcMain.handle(IpcChannels.REVIEW_WORKTREE_GET_STATUS, async (_event, pullRequest) =>
    reviewWorktreeService?.getStatus(pullRequest) ?? null
  );
  ipcMain.handle(IpcChannels.REVIEW_WORKTREE_PRELOAD, async (_event, pullRequest) =>
    reviewWorktreeService?.preloadForPullRequest(pullRequest) ?? null
  );

  ipcMain.handle(IpcChannels.REVIEW_STORAGE_GET_JOBS, async () => reviewStorageService?.loadAll() ?? []);
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_ALL, async () => {
    await reviewStorageService?.deleteAll();
    followUpService?.clearAllCache();
    if (copilotSessionManager) {
      await copilotSessionManager.deleteAllSessions();
    }
  });
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_FOR_PULL_REQUEST, async (_event, pullRequest) => {
    await reviewStorageService?.deleteForPullRequest(pullRequest);
    await followUpService?.purgePullRequest(pullRequest);
    if (copilotSessionManager && pullRequest) {
      await copilotSessionManager.deleteSessionsForPr(pullRequest.repository, pullRequest.id);
    }
  });
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_JOB_FOR_PULL_REQUEST, async (_event, pullRequest, jobId: string) => {
    await reviewStorageService?.deleteJobForPullRequest(pullRequest, jobId);
    if (!pullRequest) {
      return;
    }

    await followUpService?.purgeReviewJob(pullRequest, jobId);

    if (!copilotSessionManager) {
      return;
    }

    const hasRemainingInQueue = reviewQueueService
      .getJobs()
      .some((job) => job.pullRequest.id === pullRequest.id && job.pullRequest.repository === pullRequest.repository);
    const hasRemainingPersisted = (databaseService?.getReviewJobsForPr(pullRequest.id, pullRequest.repository).length ?? 0) > 0;

    if (!hasRemainingInQueue && !hasRemainingPersisted) {
      await copilotSessionManager.deleteSession(CopilotSessionManager.reviewKey(pullRequest.repository, pullRequest.id));
    }
  });

  ipcMain.handle(IpcChannels.PURGE_OLD_DATA, async (_event, days: number) => {
    if (!databaseService) {
      return { reviewJobs: 0, followUps: 0 };
    }
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const purgedFollowUpContextIds = databaseService.getFollowUpContextIdsOlderThan(cutoff);
    const result = databaseService.purgeOlderThan(days);
    followUpService?.clearAllCache();
    if (copilotSessionManager) {
      for (const contextId of purgedFollowUpContextIds) {
        await copilotSessionManager.deleteSession(CopilotSessionManager.followUpKey(contextId));
      }
      for (const sessionKey of databaseService.getPurgeableReviewSessionKeys(cutoff)) {
        await copilotSessionManager.deleteSession(sessionKey);
      }
    }
    return result;
  });
}