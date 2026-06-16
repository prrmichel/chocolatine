import type { PullRequestSummary } from './pullRequests';
import type { ReviewContextMode, ReviewSessionOptions } from './reviews';

export interface AskMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  modelName?: string;
}

export interface AskContext {
  id: string;
  name: string;
  modelName: string;
  messages: AskMessage[];
  isStreaming: boolean;
  createdAt: string;
}

export interface FollowUpContext {
  id: string;
  name: string;
  pullRequest: PullRequestSummary;
  reviewJobId: string;
  initialPrompt: string;
  initialResponse: string;
  modelName: string;
  messages: AskMessage[];
  isStreaming: boolean;
  sessionAvailable?: boolean;
  persistedMessageCount?: number;
  reviewSessionOptions?: ReviewSessionOptions | null;
  effectiveContextMode?: ReviewContextMode | null;
  fallbackReason?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface FollowUpContextSummary {
  id: string;
  name: string;
  pullRequestId: number;
  reviewJobId: string;
  modelName: string;
  messageCount: number;
  createdAt: string;
  updatedAt?: string;
}