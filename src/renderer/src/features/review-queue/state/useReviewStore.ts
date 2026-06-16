import { create } from 'zustand';
import { api } from '@renderer/services/api';
import { PullRequestSummary, ReviewJob, ReviewPromptContext, ReviewSessionOptions } from '@shared/types/models';
import { normalizeSelectableModelId } from '@shared/constants/modelOptions';

interface ReviewState {
  jobs: ReviewJob[];
  persistedJobs: ReviewJob[];

  loadJobs: () => Promise<void>;
  loadPersistedJobs: () => Promise<void>;
  subscribeToQueueChanges: () => () => void;

  enqueueReview: (summary: PullRequestSummary, promptText: string, modelName: string, forceNewSession?: boolean, selectedSkillIds?: string[], reviewSessionOptions?: ReviewSessionOptions | null, reviewPromptContext?: ReviewPromptContext | null) => Promise<void>;

  cancelReview: (jobId: string) => Promise<void>;
  clearResults: (pullRequestId?: number | null) => Promise<void>;
  deleteClosedPrRuns: (pullRequests: PullRequestSummary[]) => Promise<void>;
  deleteReviewsForPr: (summary: PullRequestSummary, jobId?: string | null) => Promise<void>;
  clearAllPersistedReviews: () => Promise<void>;
  clearPersistedReviewsForCompletedPrs: () => Promise<void>;

  /** Computed */
  getCompletedJobs: () => ReviewJob[];
  getCompletedJobsForDisplay: () => ReviewJob[];
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  jobs: [],
  persistedJobs: [],

  loadJobs: async () => {
    const jobs = await api.getReviewJobs();
    set({ jobs });
  },

  loadPersistedJobs: async () => {
    try {
      const loaded = await api.getPersistedReviewJobs();
      set({ persistedJobs: loaded });
    } catch (error) {
      console.error('[useReviewStore] Failed to load persisted review jobs:', error);
    }
  },

  subscribeToQueueChanges: () => {
    const unsubscribe = api.onReviewQueueChanged(() => {
      void get().loadJobs();
    });
    return unsubscribe;
  },

  enqueueReview: async (summary, promptText, modelName, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext) => {
    const effectiveModel = normalizeSelectableModelId(modelName);
    await api.enqueueReview(summary, promptText, effectiveModel, undefined, undefined, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext);
  },

  cancelReview: async (jobId) => {
    await api.cancelReview(jobId);
  },

  clearResults: async (pullRequestId) => {
    await api.clearReviewResults(pullRequestId);
    await get().loadJobs();
  },

  deleteClosedPrRuns: async (pullRequests) => {
    const unique = new Map<number, PullRequestSummary>();
    for (const pr of pullRequests) {
      unique.set(pr.id, pr);
    }
    for (const pr of unique.values()) {
      try { await api.clearReviewResults(pr.id); } catch { /* continue */ }
      try { await api.deletePersistedReviewsForPullRequest(pr); } catch { /* continue */ }
    }
    await get().loadJobs();
    await get().loadPersistedJobs();
  },

  deleteReviewsForPr: async (summary, jobId) => {
    if (jobId) {
      await api.deleteReviewJob(jobId);
      await api.deletePersistedReviewJobForPullRequest(summary, jobId);
    } else {
      await api.clearReviewResults(summary.id);
      await api.deletePersistedReviewsForPullRequest(summary);
    }
    await get().loadJobs();
    await get().loadPersistedJobs();
  },

  clearAllPersistedReviews: async () => {
    await api.deleteAllPersistedReviews();
    await get().loadPersistedJobs();
  },

  clearPersistedReviewsForCompletedPrs: async () => {
    const completed = await api.getPullRequests('completed');
    const list = (completed ?? []) as PullRequestSummary[];
    for (const pr of list) {
      try { await api.deletePersistedReviewsForPullRequest(pr); } catch { /* continue */ }
    }
    await get().loadPersistedJobs();
  },

  getCompletedJobs: () => {
    return get().jobs.filter((job) => job.status === 'Completed' || job.status === 'Failed');
  },

  getCompletedJobsForDisplay: () => {
    const completed = get().jobs.filter((job) => job.status === 'Completed' || job.status === 'Failed');
    const merged = [...completed, ...get().persistedJobs];
    const uniqueById = new Map<string, ReviewJob>();

    for (const job of merged) {
      const existing = uniqueById.get(job.id);
      if (!existing) {
        uniqueById.set(job.id, job);
        continue;
      }

      const existingTime = new Date(existing.completedAt ?? existing.startedAt ?? existing.queuedAt).getTime();
      const currentTime = new Date(job.completedAt ?? job.startedAt ?? job.queuedAt).getTime();
      if (currentTime > existingTime) {
        uniqueById.set(job.id, job);
      }
    }

    return Array.from(uniqueById.values());
  }
}));
