import {
  AppSettings,
  AskContext,
  AskMessage,
  FollowUpContext,
  FollowUpContextSummary,
  ModelInfo,
  PromptCategory,
  PromptLibrarySettings,
  PullRequestFileChange,
  PullRequestFileDiff,
  CreatePullRequestThreadInput,
  CreatePullRequestThreadResult,
  UpdatePullRequestThreadStatusInput,
  UpdatePullRequestThreadStatusResult,
  PullRequestStatus,
  PullRequestSummary,
  ReviewJob,
  ReviewPromptContext,
  ReviewSessionOptions,
  ReviewWorktreeStatus,
  SettingsSaveResult,
  SkillDiskSyncResult,
  SkillFile,
  SkillInfo,
  SkillIntegritySummary,
  SkillScope,
  SkillSyncResult
} from '@shared/types/models';

declare global {
  interface Window {
    epullrequest: {
      getSettings: () => Promise<AppSettings>;
      saveSettings: (settings: AppSettings) => Promise<SettingsSaveResult>;
      updateSettings: (partial: Partial<AppSettings>) => Promise<SettingsSaveResult>;
      pickReviewStorageFolder: () => Promise<string | null>;
      getPromptLibrary: () => Promise<PromptLibrarySettings>;
      savePromptLibrary: (settings: PromptLibrarySettings) => Promise<PromptLibrarySettings>;
      addPrompt: (category?: PromptCategory) => Promise<PromptLibrarySettings>;
      removePrompt: (id: string) => Promise<PromptLibrarySettings>;
      getPullRequests: (status: PullRequestStatus, creatorId?: string) => Promise<any[]>;
      testAdoConnection: (overrideSettings?: Partial<{ organization: string; project: string; pat: string }>) => Promise<{ ok: boolean; message: string }>;
      testOrgConnection: (orgName: string, pat: string) => Promise<{ ok: boolean; message: string }>;
      testStoredOrgConnection: (orgId: string, orgName?: string) => Promise<{ ok: boolean; message: string }>;
      setActivePrSource: (id: string | null) => Promise<AppSettings>;
      getPullRequestDetails: (id: number) => Promise<any>;
      getPullRequestWorkItems: (repositoryId: string, id: number) => Promise<any[]>;
      getPullRequestDiffs: (id: number) => Promise<any[]>;
      getPullRequestFileChanges: (id: number) => Promise<PullRequestFileChange[]>;
      getSingleFileDiff: (pullRequestId: number, filePath: string) => Promise<PullRequestFileDiff>;
      getFullFileDiff: (pullRequestId: number, filePath: string) => Promise<string>;
      getRepositories: (sourceId?: string | null) => Promise<Array<{ id: string; name: string; defaultBranch?: string }>>;
      getPullRequestThreads: (repositoryId: string, id: number) => Promise<any[]>;
      createPullRequestThread: (input: CreatePullRequestThreadInput) => Promise<CreatePullRequestThreadResult>;
      updatePullRequestThreadStatus: (input: UpdatePullRequestThreadStatusInput) => Promise<UpdatePullRequestThreadStatusResult>;
      assignReviewerToPullRequest: (repositoryId: string, id: number) => Promise<void>;
      getReviewJobs: () => Promise<any[]>;
      enqueueReview: (pullRequest: PullRequestSummary, prompt: string, modelName?: string | null, batchLabel?: string | null, batchPrompts?: string[], forceNewSession?: boolean, selectedSkillIds?: string[], reviewSessionOptions?: ReviewSessionOptions | null, reviewPromptContext?: ReviewPromptContext | null) => Promise<any>;
      getReviewWorktreeStatus: (pullRequest: PullRequestSummary) => Promise<ReviewWorktreeStatus | null>;
      preloadReviewWorktree: (pullRequest: PullRequestSummary) => Promise<ReviewWorktreeStatus | null>;
      generateSummary: (prompt: string, modelName?: string | null) => Promise<string>;
      clearReviewResults: (pullRequestId?: number | null) => Promise<void>;
      deleteReviewJob: (jobId: string) => Promise<void>;
      hideFinishedReviewRuns: () => Promise<void>;
      showAllReviewRuns: () => Promise<void>;
      cancelReview: (jobId: string) => Promise<void>;
      reloadPersistedReviews: () => Promise<void>;
      getPersistedReviewJobs: () => Promise<any[]>;
      deleteAllPersistedReviews: () => Promise<void>;
      deletePersistedReviewsForPullRequest: (pullRequest: PullRequestSummary) => Promise<void>;
      deletePersistedReviewJobForPullRequest: (pullRequest: PullRequestSummary, jobId: string) => Promise<void>;
      loadWorkItemsSummaryInstructions: () => Promise<string>;
      saveWorkItemsSummaryInstructions: (value: string) => Promise<void>;
      onReviewQueueChanged: (handler: () => void) => () => void;
      onReviewWorktreeChanged: (handler: (status: ReviewWorktreeStatus) => void) => () => void;
      createAskContext: (name?: string, modelName?: string) => Promise<AskContext>;
      deleteAskContext: (contextId: string) => Promise<void>;
      renameAskContext: (contextId: string, name: string) => Promise<AskContext | null>;
      getAskContexts: () => Promise<AskContext[]>;
      getAskMessages: (contextId: string) => Promise<AskMessage[]>;
      sendAskMessage: (contextId: string, message: string, modelName?: string) => Promise<string>;
      cancelAskMessage: (contextId: string) => Promise<void>;
      onAskDelta: (handler: (payload: { contextId: string; delta: string; fullText: string }) => void) => () => void;
      onAskMessageComplete: (handler: (payload: { contextId: string }) => void) => () => void;
      createFollowUpContext: (job: ReviewJob) => Promise<FollowUpContext>;
      deleteFollowUpContext: (pullRequest: PullRequestSummary, contextId: string) => Promise<void>;
      getFollowUpContexts: (pullRequest: PullRequestSummary) => Promise<FollowUpContextSummary[]>;
      getFollowUpContext: (pullRequest: PullRequestSummary, contextId: string) => Promise<FollowUpContext | null>;
      sendFollowUpMessage: (contextId: string, message: string, modelName?: string) => Promise<string>;
      cancelFollowUpMessage: (contextId: string) => Promise<void>;
      onFollowUpDelta: (handler: (payload: { contextId: string; delta: string; fullText: string }) => void) => () => void;
      onFollowUpMessageComplete: (handler: (payload: { contextId: string }) => void) => () => void;
      purgeOldData: (days: number) => Promise<{ reviewJobs: number; followUps: number }>;
      getUIPref: (key: string) => Promise<string | null>;
      setUIPref: (key: string, value: string | null) => Promise<void>;
      listCopilotModels: (traceId?: string) => Promise<ModelInfo[]>;
      getSkills: (scope?: SkillScope, projectKey?: string) => Promise<SkillInfo[]>;
      getSkillFiles: (skillId: string) => Promise<SkillFile[]>;
      syncProjectSkills: (orgName: string, projectName: string, repositoryId: string, repositoryName: string) => Promise<SkillSyncResult>;
      saveGlobalSkill: (name: string, description: string, content: string, linkedOrganizationIds?: string[] | null, existingId?: string) => Promise<SkillInfo>;
      deleteGlobalSkill: (id: string) => Promise<void>;
      deleteProjectSkill: (id: string) => Promise<void>;
      toggleSkillHidden: (id: string, isHidden: boolean) => Promise<void>;
      updateSkillLinkedOrganizations: (id: string, linkedOrganizationIds: string[] | null) => Promise<void>;
      getSkillSyncStatus: (projectKey: string) => Promise<{ lastSyncedAt: string | null; repositoryName?: string }>;
      resolveSkillsForReview: (projectKey: string | null, selectedGlobalSkillIds?: string[]) => Promise<{ skillDirectories: string[]; disabledSkills: string[]; expectedMarkers: Array<{ skillName: string; marker: string }> }>;
      getSkillProjectKeys: () => Promise<string[]>;
      openSkillFolder: (folderPath: string) => Promise<void>;
      getSkillsIntegritySummary: () => Promise<SkillIntegritySummary>;
      validateAllSkills: () => Promise<SkillIntegritySummary>;
      saveAllSkillsToDisk: () => Promise<SkillDiskSyncResult>;
      writeToClipboard: (text: string) => void;
    };
  }
}

export type RendererApi = Window['epullrequest'];

const fail = () => Promise.reject(new Error('Preload API not available. Ensure the preload script is loaded.'));

const createMissingApi = (): RendererApi => ({
  getSettings: fail,
  saveSettings: fail,
  updateSettings: fail,
  pickReviewStorageFolder: fail,
  getPromptLibrary: fail,
  savePromptLibrary: fail,
  addPrompt: fail,
  removePrompt: fail,
  getPullRequests: fail,
  testAdoConnection: fail,
  testOrgConnection: fail,
  testStoredOrgConnection: fail,
  setActivePrSource: fail,
  getPullRequestDetails: fail,
  getPullRequestWorkItems: fail,
  getPullRequestDiffs: fail,
  getPullRequestFileChanges: fail,
  getSingleFileDiff: fail,
  getFullFileDiff: fail,
  getRepositories: fail,
  getPullRequestThreads: fail,
  createPullRequestThread: fail,
  updatePullRequestThreadStatus: fail,
  assignReviewerToPullRequest: fail,
  getReviewJobs: fail,
  enqueueReview: fail,
  getReviewWorktreeStatus: fail,
  preloadReviewWorktree: fail,
  generateSummary: fail,
  clearReviewResults: fail,
  deleteReviewJob: fail,
  hideFinishedReviewRuns: fail,
  showAllReviewRuns: fail,
  cancelReview: fail,
  reloadPersistedReviews: fail,
  getPersistedReviewJobs: fail,
  deleteAllPersistedReviews: fail,
  deletePersistedReviewsForPullRequest: fail,
  deletePersistedReviewJobForPullRequest: fail,
  loadWorkItemsSummaryInstructions: fail,
  saveWorkItemsSummaryInstructions: fail,
  onReviewQueueChanged: () => () => {},
  onReviewWorktreeChanged: () => () => {},
  createAskContext: fail,
  deleteAskContext: fail,
  renameAskContext: fail,
  getAskContexts: fail,
  getAskMessages: fail,
  sendAskMessage: fail,
  cancelAskMessage: fail,
  onAskDelta: () => () => {},
  onAskMessageComplete: () => () => {},
  createFollowUpContext: fail,
  deleteFollowUpContext: fail,
  getFollowUpContexts: fail,
  getFollowUpContext: fail,
  sendFollowUpMessage: fail,
  cancelFollowUpMessage: fail,
  onFollowUpDelta: () => () => {},
  onFollowUpMessageComplete: () => () => {},
  purgeOldData: fail,
  getUIPref: fail,
  setUIPref: fail,
  listCopilotModels: fail,
  getSkills: fail,
  getSkillFiles: fail,
  syncProjectSkills: fail,
  saveGlobalSkill: fail,
  deleteGlobalSkill: fail,
  deleteProjectSkill: fail,
  toggleSkillHidden: fail,
  updateSkillLinkedOrganizations: fail,
  getSkillSyncStatus: fail,
  resolveSkillsForReview: fail,
  getSkillProjectKeys: fail,
  openSkillFolder: fail,
  getSkillsIntegritySummary: fail,
  validateAllSkills: fail,
  saveAllSkillsToDisk: fail,
  writeToClipboard: () => {}
});

export const preloadApi: RendererApi = window.epullrequest ?? createMissingApi();