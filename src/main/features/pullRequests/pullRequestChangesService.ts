import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import { DiffService } from '@main/features/pullRequests/diffService';
import { PullRequestFileChange, PullRequestFileDiff } from '@shared/types/models';

/** Max diff text size per file (100 KB). Larger diffs are truncated. */
const MAX_DIFF_TEXT_SIZE = 100_000;
/** Concurrent diff fetch operations. */
const DIFF_CONCURRENCY = 10;

export class PullRequestChangesService {
  constructor(private readonly client: AzureDevOpsService, private readonly diffService: DiffService) {}

  /**
   * Return only file metadata (paths + changeTypes) for a PR — no diff text.
   * This is fast and allows the UI to show the file tree immediately.
   */
  async getPullRequestFileChanges(pullRequestId: number): Promise<PullRequestFileChange[]> {
    const details = await this.client.getPullRequestDetails(pullRequestId);
    const iterations = await this.client.getPullRequestIterations(details.repositoryId, pullRequestId);
    if (iterations.length === 0) {
      return [];
    }
    const last = iterations.sort((a, b) => a.id - b.id).at(-1)!;
    return this.client.getChangesForIteration(details.repositoryId, pullRequestId, last.id);
  }

  /**
   * Fetch the diff text for a single file in a PR (standard context lines).
   */
  async getSingleFileDiff(pullRequestId: number, filePath: string): Promise<PullRequestFileDiff> {
    const details = await this.client.getPullRequestDetails(pullRequestId);
    const diffText = await this.buildDiff(details.repositoryId, filePath, details.targetCommitId, details.sourceCommitId);
    const changeType = ''; // caller already has this from file changes
    return { path: filePath, changeType, diffText };
  }

  async getPullRequestFileDiffs(pullRequestId: number): Promise<PullRequestFileDiff[]> {
    const details = await this.client.getPullRequestDetails(pullRequestId);
    const iterations = await this.client.getPullRequestIterations(details.repositoryId, pullRequestId);
    if (iterations.length === 0) {
      return [];
    }

    const last = iterations.sort((a, b) => a.id - b.id).at(-1)!;
    const baseCommit = details.targetCommitId;
    const targetCommit = details.sourceCommitId;
    const changes = await this.client.getChangesForIteration(details.repositoryId, pullRequestId, last.id);

    // Fetch diffs in parallel with bounded concurrency
    const diffs: PullRequestFileDiff[] = [];
    const queue = [...changes];
    const inflight: Promise<void>[] = [];

    const processOne = async () => {
      while (queue.length > 0) {
        const change = queue.shift()!;
        const diffText = await this.buildDiff(details.repositoryId, change.path, baseCommit, targetCommit);
        diffs.push({ path: change.path, changeType: change.changeType, diffText });
      }
    };

    for (let i = 0; i < Math.min(DIFF_CONCURRENCY, queue.length); i++) {
      inflight.push(processOne());
    }
    await Promise.all(inflight);

    return diffs;
  }

  async getFullFileDiff(pullRequestId: number, filePath: string): Promise<string> {
    const details = await this.client.getPullRequestDetails(pullRequestId);
    if (!details.repositoryId || !details.targetCommitId || !details.sourceCommitId) {
      return '';
    }
    const baseText = await this.client.getItemContent(details.repositoryId, filePath, details.targetCommitId).catch(() => '');
    const targetText = await this.client.getItemContent(details.repositoryId, filePath, details.sourceCommitId).catch(() => '');
    const diff = this.diffService.buildDiff(baseText ?? '', targetText ?? '', 999999);
    return diff.diffText;
  }

  private async buildDiff(repositoryId: string, path: string, baseCommit: string, targetCommit: string) {
    if (!baseCommit || !targetCommit) {
      return '';
    }

    const baseText = await this.client.getItemContent(repositoryId, path, baseCommit);
    const targetText = await this.client.getItemContent(repositoryId, path, targetCommit);

    if (!baseText && !targetText) {
      return '';
    }

    const diff = this.diffService.buildDiff(baseText ?? '', targetText ?? '');
    if (diff.diffText.length > MAX_DIFF_TEXT_SIZE) {
      return diff.diffText.slice(0, MAX_DIFF_TEXT_SIZE) + '\n\n[... truncated — file diff too large ...]';
    }
    return diff.diffText;
  }
}
