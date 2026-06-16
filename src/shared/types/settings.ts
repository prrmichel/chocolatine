import type { PromptLibrarySettings } from './prompts';

export interface AzureDevOpsSettings {
  organization: string;
  project: string;
  pat: string;
  apiVersion: string;
}

export interface AdoOrganization {
  id: string;
  name: string;
  pat: string;
  hasStoredPat?: boolean;
}

export interface AdoOrganizationMetadata {
  id: string;
  name: string;
}

export interface PrSource {
  id: string;
  name: string;
  organizationId: string;
  project: string;
  repository?: string | null;
}

export interface ReviewQueueSettings {
  maxConcurrentReviews: number;
}

export interface ReviewStorageSettings {
  folderPath?: string | null;
}

export interface DatabaseSettings {
  folderPath?: string | null;
}

export interface AppSettings {
  azureDevOps: AzureDevOpsSettings;
  organizations?: AdoOrganization[];
  prSources?: PrSource[];
  activePrSourceId?: string | null;
  database?: DatabaseSettings;
  reviewQueue: ReviewQueueSettings;
  reviewStorage?: ReviewStorageSettings;
  promptLibrary: PromptLibrarySettings;
  defaultModel?: string | null;
  defaultDiffViewMode?: 'inline' | 'side';
  myDisplayName?: string | null;
  skillsSourcePath?: string;
}

export type SettingsSaveIssueScope = 'organization' | 'prSource' | 'general';

export type SettingsSaveIssueCode =
  | 'protected-storage-unavailable'
  | 'pat-required'
  | 'dependent-pr-source-rejected'
  | 'invalid-organization'
  | 'invalid-pr-source';

export interface SettingsSaveIssue {
  code: SettingsSaveIssueCode;
  scope: SettingsSaveIssueScope;
  entityId?: string | null;
  message: string;
}

export interface SettingsSaveResult {
  settings: AppSettings;
  status: 'success' | 'partial';
  message: string | null;
  issues: SettingsSaveIssue[];
}