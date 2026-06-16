import { ReviewJob } from '@shared/types/models';
import { TASK_TYPE_WORK_ITEMS_SUMMARY } from '@shared/constants/timeouts';

/**
 * Map a severity string to a CSS class name.
 */
export const getSeverityClass = (severity: string): string => {
  const normalized = severity.toLowerCase();
  if (normalized.includes('error') || normalized.includes('critical')) {
    return 'severity-error';
  }
  if (normalized.includes('warning') || normalized.includes('warn')) {
    return 'severity-warning';
  }
  if (normalized.includes('info')) {
    return 'severity-info';
  }
  if (normalized.includes('high')) {
    return 'severity-error';
  }
  if (normalized.includes('medium') || normalized.includes('moderate')) {
    return 'severity-warning';
  }
  return 'severity-info';
};

/**
 * Determine the display task type for a review job.
 */
export const getTaskType = (job: ReviewJob): 'Code review' | 'Changes summary' => {
  if (job.taskType) {
    return job.taskType;
  }
  return job.prompt?.includes(TASK_TYPE_WORK_ITEMS_SUMMARY) ? 'Changes summary' : 'Code review';
};
