import type { CopilotReviewComment } from '@shared/types/models';

export interface ReviewCommentEntry {
  comment: CopilotReviewComment;
  runNumber: number;
  runId: string;
  commentKey: string;
  isFallbackPlacement?: boolean;
}
