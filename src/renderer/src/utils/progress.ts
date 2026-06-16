import { ReviewJob } from '@shared/types/models';

export const getElapsedSeconds = (job: ReviewJob): number => {
  if (!job.startedAt) return 0;
  const start = new Date(job.startedAt).getTime();
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now();
  return Math.max(0, Math.floor((end - start) / 1000));
};

export const getDisplayProgress = (job: ReviewJob): number => {
  if (job.status === 'Running') {
    const elapsed = getElapsedSeconds(job);
    const progress = Math.min(90, Math.round((elapsed / 300) * 90));
    return Math.max(5, progress);
  }
  if (job.status === 'Queued') {
    return Math.max(0, Math.min(5, job.progressPercent ?? 0));
  }
  if (job.status === 'Completed') {
    return 100;
  }
  return Math.max(0, Math.min(100, job.progressPercent ?? 0));
};

export const getProgressLabel = (job: ReviewJob, progress: number): string => {
  if (job.status === 'Queued') return 'Waiting to start';
  if (job.status === 'Running') return job.activePhaseLabel?.trim() || `${progress}% in progress`;
  if (job.status === 'Completed') return '100% completed';
  if (job.status === 'Canceled') return 'Canceled';
  if (job.status === 'Failed') return 'Failed';
  return `${progress}%`;
};
