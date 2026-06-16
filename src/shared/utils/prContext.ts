import type {
  PullRequestFileChange,
  PullRequestDetails,
  PullRequestSummary,
  PullRequestWorkItem,
  PullRequestWorkItemComment,
  ReviewPromptChangeBoundary
} from '@shared/types/models';

const normalizeText = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatWorkItemComment = (comment: PullRequestWorkItemComment, index: number): string => {
  const author = normalizeText(comment.author);
  const text = normalizeText(comment.text) ?? '';
  return `- ${index + 1}. ${author ? `${author}: ` : ''}${text}`;
};

const formatWorkItem = (workItem: PullRequestWorkItem, index: number): string => {
  const lines = [`Work item ${index + 1} (#${workItem.id})`];
  const title = normalizeText(workItem.title);
  const description = normalizeText(workItem.description);
  const acceptanceCriteria = normalizeText(workItem.acceptanceCriteria);
  const comments = workItem.comments
    ?.map((comment, commentIndex) => formatWorkItemComment(comment, commentIndex))
    .filter(Boolean) ?? [];

  if (title) {
    lines.push(`Title: ${title}`);
  }
  if (description) {
    lines.push(`Description: ${description}`);
  }
  if (acceptanceCriteria) {
    lines.push(`Acceptance criteria: ${acceptanceCriteria}`);
  }
  if (comments.length > 0) {
    lines.push('Comments:', ...comments);
  }

  return lines.join('\n');
};

export const formatPullRequestWorkItems = (workItems: PullRequestWorkItem[]): string => {
  if (workItems.length === 0) {
    return 'No linked work items.';
  }

  return workItems.map((workItem, index) => formatWorkItem(workItem, index)).join('\n\n');
};

export const buildPrContextBlock = (
  summary: PullRequestSummary,
  details: PullRequestDetails | null,
  workItems: PullRequestWorkItem[]
): string => {
  const title = normalizeText(details?.title) ?? normalizeText(summary.title) ?? '(Untitled pull request)';
  const description = normalizeText(details?.description);

  return [
    '[PR_CONTEXT]',
    `Pull request title: ${title}`,
    '',
    'Pull request description:',
    description ?? 'None.',
    '',
    'Linked work items:',
    formatPullRequestWorkItems(workItems)
  ].join('\n').trimEnd();
};

export const buildReviewTrackingRefs = (pullRequestId: number): {
  sourceTrackingRef: string;
  targetTrackingRef: string;
  compareCommand: string;
} => {
  const sourceTrackingRef = `refs/review/source/pr-${pullRequestId}`;
  const targetTrackingRef = `refs/review/target/pr-${pullRequestId}`;
  return {
    sourceTrackingRef,
    targetTrackingRef,
    compareCommand: `git diff --find-renames ${targetTrackingRef} ${sourceTrackingRef}`
  };
};

export const buildPrChangeBoundary = (
  pullRequestId: number,
  details: PullRequestDetails,
  changedFiles: PullRequestFileChange[]
): ReviewPromptChangeBoundary => {
  const refs = buildReviewTrackingRefs(pullRequestId);
  return {
    sourceBranch: details.sourceBranch,
    targetBranch: details.targetBranch,
    sourceCommitId: details.sourceCommitId,
    targetCommitId: details.targetCommitId,
    sourceTrackingRef: refs.sourceTrackingRef,
    targetTrackingRef: refs.targetTrackingRef,
    compareCommand: refs.compareCommand,
    changedFiles
  };
};

export const formatPullRequestFileChanges = (changedFiles: PullRequestFileChange[]): string => {
  if (changedFiles.length === 0) {
    return 'No changed files available.';
  }

  return changedFiles
    .map((fileChange) => `- ${fileChange.changeType || 'unknown'}: ${fileChange.path}`)
    .join('\n');
};

export const buildPrChangeBoundaryBlock = (boundary: ReviewPromptChangeBoundary): string => {
  return [
    '[PR_CHANGE_BOUNDARY]',
    `Base ref: ${boundary.targetBranch}`,
    `Head ref: ${boundary.sourceBranch}`,
    `Base commit: ${normalizeText(boundary.targetCommitId) ?? 'unknown'}`,
    `Head commit: ${normalizeText(boundary.sourceCommitId) ?? 'unknown'}`,
    `Local target ref: ${boundary.targetTrackingRef}`,
    `Local source ref: ${boundary.sourceTrackingRef}`,
    `Local comparison command: ${boundary.compareCommand}`,
    '',
    'Changed files:',
    formatPullRequestFileChanges(boundary.changedFiles)
  ].join('\n').trimEnd();
};
