import { CopilotSessionManager } from '@main/core/copilot/copilotSessionManager';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { PromptLibraryService } from '@main/core/persistence/promptLibraryService';
import { ReviewStorageService } from '@main/core/persistence/reviewStorageService';
import { SettingsStore } from '@main/core/persistence/settingsStore';
import { AskService } from '@main/features/ask/askService';
import { FollowUpService } from '@main/features/followUp/followUpService';
import { PullRequestChangesService } from '@main/features/pullRequests/pullRequestChangesService';
import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import { ReviewQueueService } from '@main/features/reviewQueue/reviewQueueService';
import { ReviewWorktreeService } from '@main/features/reviewWorktree/reviewWorktreeService';
import { SkillsService } from '@main/features/skills/skillsService';

export type RegisterIpcArgs = [
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
];

export interface MainIpcServices {
  settingsStore: SettingsStore;
  azureDevOpsService: AzureDevOpsService;
  changesService: PullRequestChangesService;
  promptLibraryService: PromptLibraryService;
  reviewQueueService: ReviewQueueService;
  reviewStorageService?: ReviewStorageService;
  askService?: AskService;
  followUpService?: FollowUpService;
  databaseService?: DatabaseService;
  copilotSessionManager?: CopilotSessionManager;
  skillsService?: SkillsService;
  reviewWorktreeService?: ReviewWorktreeService;
}

export const MainIpcServices = {
  fromArgs(...args: RegisterIpcArgs): MainIpcServices {
    const [
      settingsStore,
      azureDevOpsService,
      changesService,
      promptLibraryService,
      reviewQueueService,
      reviewStorageService,
      askService,
      followUpService,
      databaseService,
      copilotSessionManager,
      skillsService,
      reviewWorktreeService
    ] = args;

    return {
      settingsStore,
      azureDevOpsService,
      changesService,
      promptLibraryService,
      reviewQueueService,
      reviewStorageService,
      askService,
      followUpService,
      databaseService,
      copilotSessionManager,
      skillsService,
      reviewWorktreeService
    };
  }
};