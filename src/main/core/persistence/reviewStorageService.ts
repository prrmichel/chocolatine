import {
  FollowUpContext,
  FollowUpContextSummary,
  PromptLibrarySettings,
  PullRequestSummary,
  ReviewJob
} from '@shared/types/models';
import { DatabaseService } from '@main/core/persistence/databaseService';

/**
 * ReviewStorageService — now a thin facade over DatabaseService.
 * The public API surface is unchanged so IPC handlers and other services
 * continue to work without modification.
 */
export class ReviewStorageService {
  constructor(private readonly database: DatabaseService) {}

  // ─── Review jobs ────────────────────────────────────────────────

  async loadAll(): Promise<ReviewJob[]> {
    return this.database.getAllReviewJobs();
  }

  async appendJob(job: ReviewJob): Promise<void> {
    if (job.status !== 'Completed' && job.status !== 'Failed') {
      return;
    }
    this.database.upsertReviewJob(job);
  }

  async deleteForPullRequest(pullRequest: PullRequestSummary): Promise<void> {
    this.database.deleteReviewJobsForPr(pullRequest.id, pullRequest.repository);
  }

  async deleteJobForPullRequest(_pullRequest: PullRequestSummary, jobId: string): Promise<void> {
    this.database.deleteReviewJob(jobId);
  }

  async deleteAll(): Promise<void> {
    this.database.deleteAllReviewJobs();
    this.database.deleteAllFollowUps();
  }

  // ─── Prompt library ─────────────────────────────────────────────

  async loadPromptLibrary(): Promise<PromptLibrarySettings | null> {
    const lib = this.database.getPromptLibrary();
    return lib.prompts.length > 0 ? lib : null;
  }

  async savePromptLibrary(library: PromptLibrarySettings): Promise<void> {
    this.database.savePromptLibrary(library);
  }

  // ─── Work items summary instructions ────────────────────────────

  async loadWorkItemsSummaryInstructions(): Promise<string> {
    return this.database.getWorkItemsSummaryInstructions();
  }

  async saveWorkItemsSummaryInstructions(value: string): Promise<void> {
    this.database.setWorkItemsSummaryInstructions(value);
  }

  // ─── Follow-up persistence ──────────────────────────────────────

  async loadFollowUpContexts(pullRequest: PullRequestSummary): Promise<FollowUpContext[]> {
    return this.database.getFollowUpContexts(pullRequest.id, pullRequest.repository);
  }

  async loadFollowUpContextSummaries(pullRequest: PullRequestSummary): Promise<FollowUpContextSummary[]> {
    return this.database.getFollowUpContextSummaries(pullRequest.id, pullRequest.repository);
  }

  async loadFollowUpContext(_pullRequest: PullRequestSummary, contextId: string): Promise<FollowUpContext | null> {
    return this.database.getFollowUpContext(contextId);
  }

  async saveFollowUpContext(context: FollowUpContext): Promise<void> {
    this.database.saveFollowUpContext(context);
  }

  async deleteFollowUpContext(_pullRequest: PullRequestSummary, contextId: string): Promise<void> {
    this.database.deleteFollowUpContext(contextId);
  }

  async getFollowUpContextIdsForReviewJob(jobId: string): Promise<string[]> {
    return this.database.getFollowUpContextIdsForReviewJob(jobId);
  }

  async deleteFollowUpsForReviewJob(jobId: string): Promise<void> {
    this.database.deleteFollowUpsForReviewJob(jobId);
  }

  async deleteFollowUpsForPullRequest(pullRequest: PullRequestSummary): Promise<void> {
    this.database.deleteFollowUpsForPr(pullRequest.id, pullRequest.repository);
  }
}

