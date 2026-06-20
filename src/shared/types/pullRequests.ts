export type PullRequestStatus = 'active' | 'completed' | 'abandoned' | 'all';

export interface PullRequestReviewerAudience {
  name: string;
  vote?: number | null;
}

export interface PullRequestSummary {
  id: number;
  title: string;
  repository: string;
  author: string;
  authorId?: string;
  reviewerAudiences?: PullRequestReviewerAudience[];
  reviewers?: { name: string; vote?: number | null }[];
  status: string;
  isDraft: boolean;
  sourceRef: string;
  targetRef: string;
  createdDate: string;
}

export interface PullRequestDetails {
  id: number;
  title: string;
  description: string;
  repositoryId: string;
  repositoryName: string;
  author: string;
  status: string;
  isDraft: boolean;
  sourceBranch: string;
  targetBranch: string;
  createdDate: string;
  sourceCommitId: string;
  targetCommitId: string;
  reviewers?: PullRequestReviewer[];
}

export interface PullRequestReviewer {
  id?: string;
  name: string;
  vote?: number | null;
  isRequired?: boolean;
  isContainer?: boolean;
}

export interface PullRequestIteration {
  id: number;
  sourceCommitId?: string | null;
  targetCommitId?: string | null;
}

export interface PullRequestFileChange {
  path: string;
  changeType: string;
}

export interface PullRequestFileDiff {
  path: string;
  changeType: string;
  diffText: string;
}

export interface PullRequestWorkItem {
  id: number;
  url: string;
  title?: string;
  description?: string;
  acceptanceCriteria?: string;
  reproStepsOrNewsletterDescription?: string;
  comments?: PullRequestWorkItemComment[];
}

export interface PullRequestWorkItemComment {
  text: string;
  author?: string;
}

export interface PullRequestThreadComment {
  id: number;
  content: string;
  author: string;
  publishedDate: string;
  likedBy?: string[];
}

export interface PullRequestThread {
  id: number;
  status: string;
  filePath?: string;
  line?: number;
  comments: PullRequestThreadComment[];
  isResolved: boolean;
}

export interface CreatePullRequestThreadInput {
  repositoryId: string;
  pullRequestId: number;
  content: string;
  filePath?: string | null;
  line?: number | null;
}

export interface CreatePullRequestThreadResult {
  threadId: number;
  commentId: number;
  publishedDate: string;
  filePath?: string;
  line?: number;
}

export interface UpdatePullRequestThreadStatusInput {
  repositoryId: string;
  pullRequestId: number;
  threadId: number;
  status: 'active' | 'resolved';
}

export interface UpdatePullRequestThreadStatusResult {
  threadId: number;
  status: string;
  isResolved: boolean;
}