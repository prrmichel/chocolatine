import { BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import { PullRequestChangesService } from '@main/features/pullRequests/pullRequestChangesService';
import { PromptLibraryService } from '@main/core/persistence/promptLibraryService';
import { ReviewQueueService } from '@main/features/reviewQueue/reviewQueueService';
import { ReviewStorageService } from '@main/core/persistence/reviewStorageService';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { AskService } from '@main/features/ask/askService';
import { FollowUpService } from '@main/features/followUp/followUpService';
import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { ReviewWorktreeService } from '@main/features/reviewWorktree/reviewWorktreeService';
import { SettingsStore } from '@main/core/persistence/settingsStore';
import { SkillsService } from '@main/features/skills/skillsService';
import { IpcChannels } from '@shared/constants/ipcChannels';

function getDatabaseTargetFolder(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error('Database folder path must be a string when provided.');
  }
  const trimmedValue = value.trim();
  return trimmedValue || null;
}

export const registerIpc = (
  settingsStore: SettingsStore,
  azureDevOpsService: AzureDevOpsService,
  changesService: PullRequestChangesService,
  promptLibraryService: PromptLibraryService,
  reviewQueueService: ReviewQueueService,
  reviewStorageService?: ReviewStorageService,
  askService?: AskService,
  followUpService?: FollowUpService,
  databaseService?: DatabaseService,
  copilotSessionManager?: CopilotSessionManager,
  skillsService?: SkillsService,
  reviewWorktreeService?: ReviewWorktreeService
) => {
  ipcMain.handle(IpcChannels.SETTINGS_GET, async () => settingsStore.getSettings());
  ipcMain.handle(IpcChannels.SETTINGS_SAVE, async (_event, settings) => {
    const targetFolder = getDatabaseTargetFolder(settings?.database?.folderPath);
    const currentFolder = settingsStore.getConfiguredDatabaseFolderPath();
    if (databaseService && targetFolder !== currentFolder) {
      databaseService.relocateDatabase(targetFolder);
    }
    return settingsStore.saveSettings(settings);
  });
  ipcMain.handle(IpcChannels.SETTINGS_UPDATE, async (_event, partial) => {
    const current = settingsStore.getSettings();
    const targetFolder = getDatabaseTargetFolder(partial?.database?.folderPath ?? current.database?.folderPath ?? null);
    const currentFolder = settingsStore.getConfiguredDatabaseFolderPath();
    if (databaseService && targetFolder !== currentFolder) {
      databaseService.relocateDatabase(targetFolder);
    }
    return settingsStore.updateSettings(partial);
  });

  ipcMain.handle(IpcChannels.SETTINGS_PICK_REVIEW_STORAGE_FOLDER, async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win ?? undefined, {
      properties: ['openDirectory', 'createDirectory']
    });
    if (result.canceled) {
      return null;
    }
    return result.filePaths?.[0] ?? null;
  });

  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_GET, async () => promptLibraryService.load());
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_SAVE, async (_event, settings) => promptLibraryService.saveSettings(settings));
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_ADD, async (_event, category) => promptLibraryService.addPrompt(category));
  ipcMain.handle(IpcChannels.PROMPT_LIBRARY_REMOVE, async (_event, id: string) => promptLibraryService.removePrompt(id));

  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUESTS, async (_event, status, creatorId?: string) => azureDevOpsService.getPullRequests(status, creatorId));
  ipcMain.handle(IpcChannels.AZURE_TEST_CONNECTION, async (_event, overrideSettings) => azureDevOpsService.testConnection(overrideSettings));
  ipcMain.handle(IpcChannels.AZURE_TEST_ORG_CONNECTION, async (_event, orgName: string, pat: string) => settingsStore.testOrgConnection(orgName, pat));
  ipcMain.handle(IpcChannels.SETTINGS_SET_ACTIVE_PR_SOURCE, async (_event, id: string | null) => {
    settingsStore.setActivePrSource(id);
    return settingsStore.getSettings();
  });
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_DETAILS, async (_event, id) => azureDevOpsService.getPullRequestDetails(id));
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_WORK_ITEMS, async (_event, repositoryId, id) => azureDevOpsService.getPullRequestWorkItems(repositoryId, id));
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_DIFFS, async (_event, id) => changesService.getPullRequestFileDiffs(id));
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_FILE_CHANGES, async (_event, id) => changesService.getPullRequestFileChanges(id));
  ipcMain.handle(IpcChannels.AZURE_GET_SINGLE_FILE_DIFF, async (_event, pullRequestId: number, filePath: string) => changesService.getSingleFileDiff(pullRequestId, filePath));
  ipcMain.handle(IpcChannels.AZURE_GET_FULL_FILE_DIFF, async (_event, pullRequestId: number, filePath: string) => changesService.getFullFileDiff(pullRequestId, filePath));
  ipcMain.handle(IpcChannels.AZURE_GET_REPOSITORIES, async (_event, sourceId?: string | null) => {
    const runtime = settingsStore.getAzureDevOpsRuntimeAccess(sourceId ?? null);
    return azureDevOpsService.getRepositories(runtime.settings);
  });
  ipcMain.handle(IpcChannels.AZURE_GET_PULL_REQUEST_THREADS, async (_event, repositoryId, id) => azureDevOpsService.getPullRequestThreads(repositoryId, id));
  ipcMain.handle(IpcChannels.AZURE_CREATE_PULL_REQUEST_THREAD, async (_event, input) => azureDevOpsService.createPullRequestThread(input));
  ipcMain.handle(IpcChannels.AZURE_UPDATE_PULL_REQUEST_THREAD_STATUS, async (_event, input) => azureDevOpsService.updatePullRequestThreadStatus(input));
  ipcMain.handle(IpcChannels.AZURE_ASSIGN_REVIEWER_TO_PULL_REQUEST, async (_event, repositoryId, id) => azureDevOpsService.assignReviewerToPullRequest(repositoryId, id));

  ipcMain.handle(IpcChannels.REVIEW_QUEUE_GET_JOBS, async () => reviewQueueService.getJobs());
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_ENQUEUE, async (_event, pullRequest, prompt, modelName, batchLabel, batchPrompts, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext) => reviewQueueService.enqueueReview(pullRequest, prompt, modelName, batchLabel, batchPrompts, forceNewSession, selectedSkillIds, reviewSessionOptions, reviewPromptContext));
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_GENERATE_SUMMARY, async (_event, prompt, modelName) => reviewQueueService.generateSummary(prompt, modelName));
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_CLEAR_RESULTS, async (_event, pullRequestId?: number | null) => reviewQueueService.clearResults(pullRequestId));
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_DELETE_JOB, async (_event, jobId: string) => reviewQueueService.deleteJob(jobId));
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_CANCEL, async (_event, jobId: string) => reviewQueueService.cancelJob(jobId));
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_RELOAD_PERSISTED, async () => reviewQueueService.reloadPersisted());
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_HIDE_FINISHED, async () => reviewQueueService.hideFinishedInQueue());
  ipcMain.handle(IpcChannels.REVIEW_QUEUE_SHOW_ALL, async () => reviewQueueService.showAllInQueue());
  ipcMain.handle(IpcChannels.REVIEW_WORKTREE_GET_STATUS, async (_event, pullRequest) => reviewWorktreeService?.getStatus(pullRequest) ?? null);
  ipcMain.handle(IpcChannels.REVIEW_WORKTREE_PRELOAD, async (_event, pullRequest) => reviewWorktreeService?.preloadForPullRequest(pullRequest) ?? null);

  ipcMain.handle(IpcChannels.REVIEW_STORAGE_GET_JOBS, async () => reviewStorageService?.loadAll() ?? []);
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_ALL, async () => {
    await reviewStorageService?.deleteAll();
    followUpService?.clearAllCache();
    // Clean up all Copilot sessions when all reviews are deleted
    if (copilotSessionManager) {
      void copilotSessionManager.deleteAllSessions();
    }
  });
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_FOR_PULL_REQUEST, async (_event, pullRequest) => {
    await reviewStorageService?.deleteForPullRequest(pullRequest);
    await followUpService?.purgePullRequest(pullRequest);
    // Clean up Copilot sessions for this PR
    if (copilotSessionManager && pullRequest) {
      void copilotSessionManager.deleteSessionsForPr(pullRequest.repository, pullRequest.id);
    }
  });
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_DELETE_JOB_FOR_PULL_REQUEST, async (_event, pullRequest, jobId: string) => {
    await reviewStorageService?.deleteJobForPullRequest(pullRequest, jobId);
    if (!pullRequest) {
      return;
    }

    await followUpService?.purgeReviewJob(pullRequest, jobId);

    if (!copilotSessionManager) {
      return;
    }

    const hasRemainingInQueue = reviewQueueService
      .getJobs()
      .some((job) => job.pullRequest.id === pullRequest.id && job.pullRequest.repository === pullRequest.repository);
    const hasRemainingPersisted = (databaseService?.getReviewJobsForPr(pullRequest.id, pullRequest.repository).length ?? 0) > 0;

    if (!hasRemainingInQueue && !hasRemainingPersisted) {
      await copilotSessionManager.deleteSession(CopilotSessionManager.reviewKey(pullRequest.repository, pullRequest.id));
    }
  });
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_LOAD_WORK_ITEMS_SUMMARY_INSTRUCTIONS, async () => reviewStorageService?.loadWorkItemsSummaryInstructions() ?? '');
  ipcMain.handle(IpcChannels.REVIEW_STORAGE_SAVE_WORK_ITEMS_SUMMARY_INSTRUCTIONS, async (_event, value: string) => {
    await reviewStorageService?.saveWorkItemsSummaryInstructions(value ?? '');
  });

  // Ask (chat) feature
  ipcMain.handle(IpcChannels.ASK_CREATE_CONTEXT, async (_event, name?: string, modelName?: string) => askService?.createContext(name, modelName));
  ipcMain.handle(IpcChannels.ASK_DELETE_CONTEXT, async (_event, contextId: string) => askService?.deleteContext(contextId));
  ipcMain.handle(IpcChannels.ASK_RENAME_CONTEXT, async (_event, contextId: string, name: string) => askService?.renameContext(contextId, name));
  ipcMain.handle(IpcChannels.ASK_GET_CONTEXTS, async () => askService?.getContexts() ?? []);
  ipcMain.handle(IpcChannels.ASK_GET_MESSAGES, async (_event, contextId: string) => askService?.getMessages(contextId) ?? []);
  ipcMain.handle(IpcChannels.ASK_SEND, async (_event, contextId: string, message: string, modelName?: string) => askService?.sendMessage(contextId, message, modelName));
  ipcMain.handle(IpcChannels.ASK_CANCEL, async (_event, contextId: string) => askService?.cancelMessage(contextId));

  // Follow-up chat on review runs
  ipcMain.handle(IpcChannels.FOLLOW_UP_CREATE_CONTEXT, async (_event, job) => followUpService?.createContext(job));
  ipcMain.handle(IpcChannels.FOLLOW_UP_DELETE_CONTEXT, async (_event, pullRequest, contextId: string) => followUpService?.deleteContext(pullRequest, contextId));
  ipcMain.handle(IpcChannels.FOLLOW_UP_GET_CONTEXTS, async (_event, pullRequest) => followUpService?.getContextSummaries(pullRequest) ?? []);
  ipcMain.handle(IpcChannels.FOLLOW_UP_GET_CONTEXT, async (_event, pullRequest, contextId: string) => followUpService?.getContext(pullRequest, contextId));
  ipcMain.handle(IpcChannels.FOLLOW_UP_SEND, async (_event, contextId: string, message: string, modelName?: string) => followUpService?.sendMessage(contextId, message, modelName));
  ipcMain.handle(IpcChannels.FOLLOW_UP_CANCEL, async (_event, contextId: string) => followUpService?.cancelMessage(contextId));

  // Data management
  ipcMain.handle(IpcChannels.PURGE_OLD_DATA, async (_event, days: number) => {
    if (!databaseService) return { reviewJobs: 0, followUps: 0 };
    const result = databaseService.purgeOlderThan(days);
    followUpService?.clearAllCache();
    return result;
  });

  // Generic UI preferences
  ipcMain.handle(IpcChannels.UI_PREF_GET, async (_event, key: string) =>
    databaseService?.getPreference(key) ?? null
  );
  ipcMain.handle(IpcChannels.UI_PREF_SET, async (_event, key: string, value: string | null) => {
    databaseService?.setPreference(key, value);
  });

  // Copilot SDK
  ipcMain.handle(IpcChannels.COPILOT_LIST_MODELS, async (_event, traceId?: string | null) => {
    const resolvedTraceId = traceId?.trim() || 'none';
    if (!copilotSessionManager) {
      console.warn(`[ipc][models] No CopilotSessionManager available (traceId=${resolvedTraceId})`);
      return [];
    }
    const models = await copilotSessionManager.listModels(resolvedTraceId);
    return models;
  });

  // Skills Library
  ipcMain.handle(IpcChannels.SKILLS_GET_ALL, async (_event, scope?: string, projectKey?: string) =>
    skillsService?.getAll(scope as any, projectKey) ?? []
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_FILES, async (_event, skillId: string) =>
    skillsService?.getSkillFiles(skillId) ?? []
  );
  ipcMain.handle(
    IpcChannels.SKILLS_SYNC_PROJECT,
    async (_event, orgName: string, projectName: string, repositoryId: string, repositoryName: string) =>
      skillsService?.syncProjectSkills(orgName, projectName, repositoryId, repositoryName)
  );
  ipcMain.handle(IpcChannels.SKILLS_SAVE_GLOBAL, async (_event, name: string, description: string, content: string, linkedOrganizationIds?: string[] | null, existingId?: string) =>
    skillsService?.saveGlobalSkill(name, description, content, linkedOrganizationIds, existingId)
  );
  ipcMain.handle(IpcChannels.SKILLS_DELETE_GLOBAL, async (_event, id: string) =>
    skillsService?.deleteGlobalSkill(id)
  );
  ipcMain.handle(IpcChannels.SKILLS_DELETE_PROJECT, async (_event, id: string) =>
    skillsService?.deleteProjectSkill(id)
  );
  ipcMain.handle(IpcChannels.SKILLS_TOGGLE_HIDDEN, async (_event, id: string, isHidden: boolean) =>
    skillsService?.toggleSkillHidden(id, isHidden)
  );
  ipcMain.handle(IpcChannels.SKILLS_UPDATE_LINKED_ORGS, async (_event, id: string, linkedOrganizationIds: string[] | null) =>
    skillsService?.updateSkillLinkedOrganizations(id, linkedOrganizationIds)
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_SYNC_STATUS, async (_event, projectKey: string) =>
    skillsService?.getSyncStatus(projectKey) ?? { lastSyncedAt: null }
  );
  ipcMain.handle(
    IpcChannels.SKILLS_RESOLVE_FOR_REVIEW,
    async (_event, projectKey: string | null, selectedGlobalSkillIds?: string[]) =>
      skillsService?.resolveSkillsForReview(projectKey, null, selectedGlobalSkillIds) ?? { skillDirectories: [], disabledSkills: [], expectedMarkers: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_GET_PROJECT_KEYS, async () =>
    skillsService?.getProjectKeys() ?? []
  );
  ipcMain.handle(IpcChannels.SKILLS_OPEN_FOLDER, async (_event, folderPath: string) => {
    if (folderPath) {
      await shell.openPath(folderPath);
    }
  });
  ipcMain.handle(IpcChannels.SKILLS_GET_INTEGRITY_SUMMARY, async () =>
    skillsService?.getIntegritySummary() ?? { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_VALIDATE_ALL, async () =>
    skillsService?.validateAllSkillsIntegrity() ?? { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
  );
  ipcMain.handle(IpcChannels.SKILLS_SAVE_ALL_TO_DISK, async () =>
    skillsService?.saveAllSkillsToDisk() ?? {
      savedCount: 0,
      skippedCount: 0,
      failed: [],
      summary: { totalSkills: 0, mismatchCount: 0, lastValidatedAt: null, mismatches: [] }
    }
  );
};
