import type { PullRequestFileChange, PullRequestSummary } from './pullRequests';
import type { SkillMarkerResult } from './skills';

export type ReviewJobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Canceled';
export type ReviewContextMode = 'diff-only' | 'branch-aware';

export interface ReviewHistoryEntry {
  attempt: number;
  prompt: string;
  sentPrompt: string;
  response: string;
  startedAt: string;
  completedAt: string;
  attemptUsageSummary?: ReviewAttemptUsageSummary;
  isReReview?: boolean;
  sessionKey?: string;
}

export interface ReviewAttemptUsageSummary {
  modelUsed: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  durationMs?: number;
  requestCount?: number;
  estimatedCost?: number;
}

export interface CopilotReviewComment {
  id?: string;
  reviewArea?: string;
  category?: string;
  severity?: string;
  file?: string;
  lineNew?: number;
  lineOld?: number;
  message?: string;
  solution?: string;
  suggestion?: string;
  evidence?: string;
}

export interface ReviewSessionOptions {
  requestedContextMode?: ReviewContextMode | null;
  workingDirectory?: string | null;
}

export interface ReviewPromptChangeBoundary {
  sourceBranch: string;
  targetBranch: string;
  sourceCommitId?: string | null;
  targetCommitId?: string | null;
  sourceTrackingRef: string;
  targetTrackingRef: string;
  compareCommand: string;
  changedFiles: PullRequestFileChange[];
}

export interface ReviewPromptContext {
  changedFiles?: PullRequestFileChange[] | null;
  prChangeBoundary?: ReviewPromptChangeBoundary | null;
}

export type ReviewWorktreeState = 'ready' | 'refreshing' | 'unavailable' | 'blocked';
export type ReviewWorktreeBlockingReason = 'missing-root-folder';

export interface ReviewWorktreeStatus {
  pullRequestId: number;
  repository: string;
  state: ReviewWorktreeState;
  statusMessage: string;
  blockingReason?: ReviewWorktreeBlockingReason | null;
  workingDirectory?: string | null;
  mirrorPath?: string | null;
  sourceBranch?: string | null;
  targetBranch?: string | null;
  sourceCommitId?: string | null;
  targetCommitId?: string | null;
  updatedAt?: string | null;
  errorMessage?: string | null;
}

export interface ReviewJob {
  id: string;
  pullRequest: PullRequestSummary;
  taskType?: 'Code review' | 'Changes summary';
  prompt: string;
  modelName?: string | null;
  status: ReviewJobStatus;
  progressPercent: number;
  reviewResponse?: string | null;
  errorMessage?: string | null;
  lastSentPrompt?: string | null;
  isReReview?: boolean;
  sessionKey?: string | null;
  queuedAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  hiddenInQueue?: boolean;
  batchLabel?: string | null;
  batchPrompts?: string[] | null;
  reviewHistory?: ReviewHistoryEntry[];
  activeSkills?: string[];
  skillMarkerResults?: SkillMarkerResult[];
  selectedGlobalSkillIds?: string[] | null;
  forceNewSession?: boolean;
  reviewSessionOptions?: ReviewSessionOptions | null;
  reviewPromptContext?: ReviewPromptContext | null;
  effectiveContextMode?: ReviewContextMode | null;
  fallbackReason?: string | null;
  activePhaseLabel?: string | null;
  debugLogs?: string[];
  attemptUsageSummary?: ReviewAttemptUsageSummary;
  persistedResult?: CopilotReviewResult | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReviewResponseMetadata {
  attemptNumber?: number;
  sessionReused?: boolean;
  priorFindingsAcknowledged?: string;
}

export interface TitleReviewResult {
  currentTitle?: string;
  isEnglish?: boolean;
  followsNamingConvention?: boolean;
  suggestedEnglishTitle?: string;
  suggestedTitle?: string;
  notes?: string;
}

export interface CopilotReviewResult {
  titleReview?: TitleReviewResult;
  comments?: CopilotReviewComment[];
  overallSummary?: string;
  reviewMetadata?: ReviewResponseMetadata;
  skillMarkerUsage?: string;
}