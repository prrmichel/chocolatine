import { PullRequestDetails, PullRequestSummary } from '@shared/types/models';

/**
 * Replaces `{Title}`, `{SourceBranch}` and `{TargetBranch}` placeholders in a
 * prompt template with values from the given pull request summary / details.
 */
export const applyPromptTemplate = (
  template: string,
  summary: PullRequestSummary,
  details: PullRequestDetails | null
): string => {
  const title = details?.title ?? summary.title ?? '(Untitled pull request)';
  const source = details?.sourceBranch ?? summary.sourceRef ?? '';
  const target = details?.targetBranch ?? summary.targetRef ?? '';
  return template
    .replace('{Title}', title)
    .replace('{SourceBranch}', source)
    .replace('{TargetBranch}', target)
    .trimEnd();
};
