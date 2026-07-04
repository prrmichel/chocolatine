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

export type ByokProviderType = 'openai';

export interface ByokProviderConfig {
  id: string;
  label: string;
  type: ByokProviderType;
  baseUrl: string;
  /** True when an API key is stored in OS-protected storage (never sent to renderer). */
  hasStoredApiKey?: boolean;
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
  byokProviders?: ByokProviderConfig[];
  activeByokProviderId?: string | null;
}

export type SettingsSaveIssueScope = 'organization' | 'prSource' | 'byokProvider' | 'general';

export type SettingsSaveIssueCode =
  | 'protected-storage-unavailable'
  | 'pat-required'
  | 'dependent-pr-source-rejected'
  | 'invalid-organization'
  | 'invalid-pr-source'
  | 'invalid-byok-provider'
  | 'api-key-required';

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