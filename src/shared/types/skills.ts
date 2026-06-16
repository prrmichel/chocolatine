export type SkillScope = 'global' | 'project';

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  scope: SkillScope;
  projectKey?: string | null;
  linkedOrganizationIds?: string[] | null;
  folderPath: string;
  isActive: boolean;
  isHidden: boolean;
  marker: string;
  lastSyncedAt?: string | null;
  contentHash?: string | null;
  diskHash?: string | null;
  isMismatched?: boolean;
  mismatchReason?: SkillMismatchReason | null;
  lastValidationAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillFile {
  path: string;
  isFolder: boolean;
  content?: string | null;
}

export interface SkillSyncResult {
  projectKey: string;
  skillCount: number;
  syncedAt: string;
  errors?: string[];
}

export interface SkillMarkerResult {
  skillName: string;
  marker: string;
  found: boolean;
}

export type SkillMismatchReason =
  | 'folder_missing'
  | 'skill_file_missing'
  | 'content_differs';

export interface SkillMismatchInfo {
  skillId: string;
  skillName: string;
  scope: SkillScope;
  projectKey?: string | null;
  reason: SkillMismatchReason;
  folderPath: string;
}

export interface SkillIntegritySummary {
  totalSkills: number;
  mismatchCount: number;
  lastValidatedAt: string | null;
  mismatches: SkillMismatchInfo[];
}

export interface SkillDiskSyncResult {
  savedCount: number;
  skippedCount: number;
  failed: Array<{ skillId: string; skillName: string; error: string }>;
  summary: SkillIntegritySummary;
}