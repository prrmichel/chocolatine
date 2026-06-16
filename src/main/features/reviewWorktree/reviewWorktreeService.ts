import { execFile } from 'child_process';
import { EventEmitter } from 'events';
import { existsSync } from 'fs';
import { mkdir, readdir, rm, stat } from 'fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'path';
import { promisify } from 'util';
import { SettingsStore } from '@main/core/persistence/settingsStore';
import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import type { PullRequestDetails, PullRequestSummary, ReviewWorktreeStatus } from '@shared/types/models';
import { buildReviewTrackingRefs } from '@shared/utils/prContext';

const execFileAsync = promisify(execFile);

const DEFAULT_UNAVAILABLE_MESSAGE = 'Branch context is not prepared yet.';
const MISSING_ROOT_FOLDER_MESSAGE = 'Configure a review worktree root folder in Settings > Preferences to enable branch-aware review.';
const ROOT_FOLDER_CHANGED_MESSAGE = 'Branch context must be refreshed after the review worktree root folder changed.';
const GIT_MAX_BUFFER_BYTES = 8 * 1024 * 1024;
const GIT_TIMEOUT_MS = 10 * 60_000;
const STALE_WORKTREE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class ReviewWorktreeService extends EventEmitter {
  private readonly statuses = new Map<string, ReviewWorktreeStatus>();
  private readonly pendingPreloads = new Map<string, Promise<ReviewWorktreeStatus>>();

  constructor(
    private readonly azureDevOpsService: AzureDevOpsService,
    private readonly settingsStore: SettingsStore
  ) {
    super();
  }

  getStatus(pullRequest: PullRequestSummary): ReviewWorktreeStatus {
    this.assertValidPullRequest(pullRequest);
    const storageRoot = this.resolveConfiguredStorageRoot(this.settingsStore.getSettings().reviewStorage?.folderPath ?? null);
    if (!storageRoot) {
      return this.buildBlockedStatus(pullRequest, MISSING_ROOT_FOLDER_MESSAGE);
    }

    const existing = this.statuses.get(this.buildKey(pullRequest));
    if (!existing) {
      return this.buildUnavailableStatus(pullRequest, DEFAULT_UNAVAILABLE_MESSAGE);
    }

    if (existing.blockingReason === 'missing-root-folder') {
      return this.buildUnavailableStatus(pullRequest, DEFAULT_UNAVAILABLE_MESSAGE);
    }

    if (!this.statusUsesStorageRoot(existing, storageRoot)) {
      return this.buildUnavailableStatus(pullRequest, ROOT_FOLDER_CHANGED_MESSAGE);
    }

    return existing;
  }

  async preloadForPullRequest(pullRequest: PullRequestSummary): Promise<ReviewWorktreeStatus> {
    this.assertValidPullRequest(pullRequest);
    const blockedStatus = this.buildBlockedStatusIfMissingRoot(pullRequest);
    if (blockedStatus) {
      this.updateStatus(blockedStatus);
      return blockedStatus;
    }

    const key = this.buildKey(pullRequest);
    const pending = this.pendingPreloads.get(key);
    if (pending) {
      return pending;
    }

    const preloadPromise = this.prepareWorktree(pullRequest);
    this.pendingPreloads.set(key, preloadPromise);
    try {
      return await preloadPromise;
    } finally {
      this.pendingPreloads.delete(key);
    }
  }

  private async prepareWorktree(pullRequest: PullRequestSummary): Promise<ReviewWorktreeStatus> {
    const existing = this.getStatus(pullRequest);
    this.updateStatus({
      ...existing,
      state: 'refreshing',
      statusMessage: 'Preparing branch context...',
      errorMessage: null,
      updatedAt: new Date().toISOString()
    });

    try {
      const details = await this.azureDevOpsService.getPullRequestDetails(pullRequest.id);
      this.assertPreloadableDetails(details);

      const { settings, credentialError } = this.settingsStore.getAzureDevOpsRuntimeAccess();
      const organization = settings.organization?.trim();
      const project = settings.project?.trim();
      const pat = settings.pat?.trim();

      if (!organization || !project || !pat) {
        throw new Error(credentialError ?? 'Azure DevOps settings are incomplete for branch-context preparation. Open Settings.');
      }

      const storageRoot = this.resolveConfiguredStorageRoot(this.settingsStore.getSettings().reviewStorage?.folderPath ?? null);
      if (!storageRoot) {
        const blockedStatus = this.buildBlockedStatus(pullRequest, MISSING_ROOT_FOLDER_MESSAGE);
        this.updateStatus(blockedStatus);
        return blockedStatus;
      }
      const managedPaths = this.buildManagedPaths(storageRoot, organization, project, details.repositoryName, pullRequest.id);
      const authHeader = buildGitAuthHeader(pat);
      const cloneUrl = buildAzureCloneUrl(organization, project, details.repositoryName);
      const boundaryRefs = buildReviewTrackingRefs(pullRequest.id);
      const fetchedSourceTrackingRef = `refs/remotes/review/source/pr-${pullRequest.id}`;
      const fetchedTargetTrackingRef = `refs/remotes/review/target/pr-${pullRequest.id}`;
      const worktreeBranch = `review/pr-${pullRequest.id}-source`;

      await mkdir(managedPaths.mirrorRoot, { recursive: true });
      await mkdir(managedPaths.worktreeRoot, { recursive: true });

      await this.ensureMirror(managedPaths.mirrorPath, managedPaths.mirrorRoot, cloneUrl, authHeader);
      await this.cleanupStaleManagedWorktrees(
        managedPaths.worktreeRoot,
        managedPaths.worktreePath,
        managedPaths.mirrorPath
      );
      await this.fetchPullRequestRefs(
        managedPaths.mirrorPath,
        details.sourceBranch,
        details.targetBranch,
        fetchedSourceTrackingRef,
        fetchedTargetTrackingRef,
        details.sourceCommitId,
        details.targetCommitId,
        authHeader
      );
      await this.pinPullRequestBoundaryRefs(
        managedPaths.mirrorPath,
        details.sourceCommitId,
        details.targetCommitId,
        boundaryRefs.sourceTrackingRef,
        boundaryRefs.targetTrackingRef
      );
      await this.recreateWorktree(
        managedPaths.mirrorPath,
        managedPaths.worktreePath,
        worktreeBranch,
        boundaryRefs.sourceTrackingRef
      );

      const readyStatus: ReviewWorktreeStatus = {
        pullRequestId: pullRequest.id,
        repository: pullRequest.repository,
        state: 'ready',
        statusMessage: `Branch context ready for ${stripHeadsPrefix(details.sourceBranch)} against ${stripHeadsPrefix(details.targetBranch)}.`,
        workingDirectory: managedPaths.worktreePath,
        mirrorPath: managedPaths.mirrorPath,
        sourceBranch: details.sourceBranch,
        targetBranch: details.targetBranch,
        sourceCommitId: details.sourceCommitId,
        targetCommitId: details.targetCommitId,
        updatedAt: new Date().toISOString(),
        blockingReason: null,
        errorMessage: null
      };
      this.updateStatus(readyStatus);
      return readyStatus;
    } catch (error) {
      const message = toErrorMessage(error);
      console.error(`[ReviewWorktree] Failed to prepare branch context for PR #${pullRequest.id}: ${message}`);
      const unavailableStatus = this.buildUnavailableStatus(
        pullRequest,
        'Branch context preparation failed.',
        message
      );
      this.updateStatus(unavailableStatus);
      return unavailableStatus;
    }
  }

  private async ensureMirror(mirrorPath: string, mirrorRoot: string, cloneUrl: string, authHeader: string): Promise<void> {
    if (existsSync(mirrorPath)) {
      try {
        const isBare = await this.runGit(['-C', mirrorPath, 'rev-parse', '--is-bare-repository']);
        if (isBare.trim() === 'true') {
          await this.runGit(['-C', mirrorPath, 'remote', 'set-url', 'origin', cloneUrl]);
          return;
        }
      } catch {
        // Recreate managed mirrors that are no longer valid.
      }
      await rm(mirrorPath, { recursive: true, force: true });
    }

    await this.runGit(['clone', '--mirror', cloneUrl, mirrorPath], { cwd: mirrorRoot, authHeader });
  }

  private async fetchPullRequestRefs(
    mirrorPath: string,
    sourceBranch: string,
    targetBranch: string,
    sourceTrackingRef: string,
    targetTrackingRef: string,
    sourceCommitId: string,
    targetCommitId: string,
    authHeader: string
  ): Promise<void> {
    await this.runGit([
      '-C',
      mirrorPath,
      'fetch',
      '--prune',
      '--no-tags',
      'origin',
      `+${sourceBranch}:${sourceTrackingRef}`,
      `+${targetBranch}:${targetTrackingRef}`
    ], { authHeader });
    await this.assertCommitAvailability(mirrorPath, targetCommitId, 'base');
    await this.assertCommitAvailability(mirrorPath, sourceCommitId, 'head');
  }

  private async pinPullRequestBoundaryRefs(
    mirrorPath: string,
    sourceCommitId: string,
    targetCommitId: string,
    sourceBoundaryRef: string,
    targetBoundaryRef: string
  ): Promise<void> {
    await this.runGit(['-C', mirrorPath, 'update-ref', targetBoundaryRef, targetCommitId]);
    await this.runGit(['-C', mirrorPath, 'update-ref', sourceBoundaryRef, sourceCommitId]);
    await this.assertPinnedRefCommit(mirrorPath, targetBoundaryRef, targetCommitId, 'base');
    await this.assertPinnedRefCommit(mirrorPath, sourceBoundaryRef, sourceCommitId, 'head');
  }

  private async recreateWorktree(
    mirrorPath: string,
    worktreePath: string,
    worktreeBranch: string,
    sourceTrackingRef: string
  ): Promise<void> {
    await this.runGit(['-C', mirrorPath, 'worktree', 'prune']);
    if (await this.tryRefreshExistingWorktree(worktreePath, worktreeBranch, sourceTrackingRef)) {
      return;
    }
    try {
      await this.runGit(['-C', mirrorPath, 'worktree', 'remove', '--force', worktreePath]);
    } catch {
      // Ignore stale-registration failures; the managed directory is removed below.
    }

    await rm(worktreePath, { recursive: true, force: true });
    try {
      await this.runGit(['-C', mirrorPath, 'branch', '-D', worktreeBranch]);
    } catch {
      // Ignore missing branch failures.
    }

    await mkdir(dirname(worktreePath), { recursive: true });
    await this.runGit(['-C', mirrorPath, 'branch', '-f', worktreeBranch, sourceTrackingRef]);
    await this.runGit(['-C', mirrorPath, 'worktree', 'add', '--force', worktreePath, worktreeBranch]);
  }

  private async tryRefreshExistingWorktree(
    worktreePath: string,
    worktreeBranch: string,
    sourceTrackingRef: string
  ): Promise<boolean> {
    if (!existsSync(worktreePath)) {
      return false;
    }

    try {
      const isWorktree = await this.runGit(['-C', worktreePath, 'rev-parse', '--is-inside-work-tree']);
      if (isWorktree.trim() !== 'true') {
        return false;
      }

      await this.runGit(['-C', worktreePath, 'checkout', '-B', worktreeBranch, sourceTrackingRef]);
      await this.runGit(['-C', worktreePath, 'reset', '--hard', sourceTrackingRef]);
      await this.runGit(['-C', worktreePath, 'clean', '-fd']);
      return true;
    } catch {
      return false;
    }
  }

  private async cleanupStaleManagedWorktrees(
    worktreeRoot: string,
    currentWorktreePath: string,
    mirrorPath: string
  ): Promise<void> {
    const now = Date.now();
    const activeWorktreePaths = new Set(
      Array.from(this.statuses.values())
        .map((status) => status.workingDirectory?.trim())
        .filter((path): path is string => Boolean(path))
    );
    const entries = await readdir(worktreeRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const entryPath = join(worktreeRoot, entry.name);
      if (entryPath === currentWorktreePath || activeWorktreePaths.has(entryPath)) {
        continue;
      }

      try {
        const entryStats = await stat(entryPath);
        if (now - entryStats.mtimeMs < STALE_WORKTREE_MAX_AGE_MS) {
          continue;
        }
      } catch {
        continue;
      }

      try {
        await this.runGit(['-C', mirrorPath, 'worktree', 'remove', '--force', entryPath]);
      } catch {
        // Ignore stale-registration failures; the directory is removed below.
      }
      await rm(entryPath, { recursive: true, force: true });
    }
  }

  private async runGit(
    args: string[],
    options?: {
      cwd?: string;
      authHeader?: string;
    }
  ): Promise<string> {
    const fullArgs = options?.authHeader
      ? ['-c', `http.extraHeader=${options.authHeader}`, ...args]
      : args;

    try {
      const { stdout } = await execFileAsync('git', fullArgs, {
        cwd: options?.cwd,
        maxBuffer: GIT_MAX_BUFFER_BYTES,
        timeout: GIT_TIMEOUT_MS,
        windowsHide: true,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0'
        }
      });
      return stdout?.trim() ?? '';
    } catch (error: any) {
      const stderr = typeof error?.stderr === 'string' ? error.stderr : error?.stderr?.toString?.();
      const stdout = typeof error?.stdout === 'string' ? error.stdout : error?.stdout?.toString?.();
      const fallback = error instanceof Error ? error.message : String(error);
      const message = [stderr, stdout, fallback]
        .map((value) => value?.trim())
        .find(Boolean);
      throw new Error(message ?? 'Git command failed.');
    }
  }

  private resolveConfiguredStorageRoot(configuredFolderPath: string | null): string | null {
    const trimmedPath = configuredFolderPath?.trim();
    if (trimmedPath) {
      return resolve(trimmedPath);
    }
    return null;
  }

  private buildManagedPaths(storageRoot: string, organization: string, project: string, repositoryName: string, pullRequestId: number) {
    const namespace = `${sanitizePathSegment(organization)}__${sanitizePathSegment(project)}`;
    const repoKey = sanitizePathSegment(repositoryName);
    const mirrorRoot = join(storageRoot, 'mirrors', namespace);
    const worktreeRoot = join(storageRoot, 'worktrees', namespace);
    return {
      mirrorRoot,
      worktreeRoot,
      mirrorPath: join(mirrorRoot, `${repoKey}.git`),
      worktreePath: join(worktreeRoot, `${repoKey}--pr-${pullRequestId}`)
    };
  }

  private buildUnavailableStatus(
    pullRequest: PullRequestSummary,
    statusMessage: string,
    errorMessage?: string | null
  ): ReviewWorktreeStatus {
    return {
      pullRequestId: pullRequest.id,
      repository: pullRequest.repository,
      state: 'unavailable',
      statusMessage,
      blockingReason: null,
      errorMessage: errorMessage ?? null,
      updatedAt: errorMessage ? new Date().toISOString() : null
    };
  }

  private buildBlockedStatus(pullRequest: PullRequestSummary, statusMessage: string): ReviewWorktreeStatus {
    return {
      pullRequestId: pullRequest.id,
      repository: pullRequest.repository,
      state: 'blocked',
      statusMessage,
      blockingReason: 'missing-root-folder',
      errorMessage: null,
      updatedAt: null
    };
  }

  private buildBlockedStatusIfMissingRoot(pullRequest: PullRequestSummary): ReviewWorktreeStatus | null {
    const storageRoot = this.resolveConfiguredStorageRoot(this.settingsStore.getSettings().reviewStorage?.folderPath ?? null);
    return storageRoot ? null : this.buildBlockedStatus(pullRequest, MISSING_ROOT_FOLDER_MESSAGE);
  }

  private statusUsesStorageRoot(status: ReviewWorktreeStatus, storageRoot: string): boolean {
    const trackedPaths = [status.workingDirectory, status.mirrorPath].filter((value): value is string => Boolean(value?.trim()));
    if (trackedPaths.length === 0) {
      return true;
    }
    return trackedPaths.every((trackedPath) => isPathWithinRoot(trackedPath, storageRoot));
  }

  private updateStatus(status: ReviewWorktreeStatus): void {
    this.statuses.set(this.buildStatusKey(status), status);
    this.emit('changed', status);
  }

  private buildKey(pullRequest: Pick<PullRequestSummary, 'id' | 'repository'>): string {
    return `${pullRequest.repository}#${pullRequest.id}`;
  }

  private buildStatusKey(status: ReviewWorktreeStatus): string {
    return `${status.repository}#${status.pullRequestId}`;
  }

  private assertValidPullRequest(pullRequest: PullRequestSummary): void {
    if (!pullRequest || typeof pullRequest.id !== 'number' || pullRequest.id <= 0) {
      throw new Error('A valid pull request selection is required.');
    }
    if (!pullRequest.repository?.trim()) {
      throw new Error('Pull request repository is required.');
    }
  }

  private assertPreloadableDetails(details: PullRequestDetails): void {
    if (!details.repositoryName?.trim()) {
      throw new Error('Pull request repository details are incomplete.');
    }
    if (!details.sourceBranch?.trim() || !details.targetBranch?.trim()) {
      throw new Error('Pull request source and target branches are required.');
    }
    if (!details.sourceCommitId?.trim() || !details.targetCommitId?.trim()) {
      throw new Error('Pull request source and target snapshot commits are required.');
    }
    if (!details.sourceBranch.startsWith('refs/') || !details.targetBranch.startsWith('refs/')) {
      throw new Error('Pull request branches must be full git refs.');
    }
  }

  private async assertCommitAvailability(mirrorPath: string, commitId: string, boundaryLabel: 'base' | 'head'): Promise<void> {
    try {
      await this.runGit(['-C', mirrorPath, 'cat-file', '-e', `${commitId}^{commit}`]);
    } catch {
      throw new Error(
        `Unable to materialize the PR ${boundaryLabel} snapshot commit (${commitId}) in the local review mirror. The branch may have moved or been force-pushed.`
      );
    }
  }

  private async assertPinnedRefCommit(
    mirrorPath: string,
    refName: string,
    expectedCommitId: string,
    boundaryLabel: 'base' | 'head'
  ): Promise<void> {
    const resolvedCommitId = await this.runGit(['-C', mirrorPath, 'rev-parse', `${refName}^{commit}`]);
    if (normalizedCommitId(resolvedCommitId) !== normalizedCommitId(expectedCommitId)) {
      throw new Error(
        `Local PR ${boundaryLabel} ref ${refName} resolved to ${resolvedCommitId}, expected ${expectedCommitId}.`
      );
    }
  }
}

function buildAzureCloneUrl(organization: string, project: string, repositoryName: string): string {
  return `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_git/${encodeURIComponent(repositoryName)}`;
}

function buildGitAuthHeader(pat: string): string {
  return `AUTHORIZATION: Basic ${Buffer.from(`:${pat}`, 'utf8').toString('base64')}`;
}

function sanitizePathSegment(value: string): string {
  const sanitized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'item';
}

function stripHeadsPrefix(refName: string): string {
  return refName.replace(/^refs\/heads\//, '');
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizedCommitId(commitId: string): string {
  return commitId.trim().toLowerCase();
}

function isPathWithinRoot(candidatePath: string, storageRoot: string): boolean {
  const relativePath = relative(resolve(storageRoot), resolve(candidatePath));
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}
