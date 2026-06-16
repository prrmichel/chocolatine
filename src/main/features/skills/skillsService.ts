import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, cpSync } from 'fs';
import { join, relative } from 'path';
import { app } from 'electron';
import { tmpdir } from 'os';
import { createHash } from 'crypto';
import {
  SkillDiskSyncResult,
  SkillFile,
  SkillInfo,
  SkillIntegritySummary,
  SkillMarkerResult,
  SkillMismatchReason,
  SkillScope,
  SkillSyncResult
} from '@shared/types/models';
import { buildSkillProjectKeyCandidates, normalizeSkillProjectKeyForMatch } from '@shared/utils/skillProjectKey';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { AzureDevOpsService } from '@main/features/pullRequests/azureDevOpsService';
import { SettingsStore } from '@main/core/persistence/settingsStore';

/** Default path inside ADO repos where skills are stored. */
const DEFAULT_SKILLS_SOURCE_PATH = '.github/skills';

/** Prefix for auto-generated skill markers. */
const MARKER_PREFIX = 'SKILL_MARKER_';

/** Placeholder token in SKILL.md that gets replaced with the actual marker at review time. */
const MARKER_PLACEHOLDER = '{{SKILL_MARKER}}';

interface SkillMeta {
  lastSyncedAt: string;
  repositoryId: string;
  repositoryName: string;
  defaultBranch: string;
}

export class SkillsService {
  private readonly skillsRootDir: string;

  constructor(
    private readonly db: DatabaseService,
    private readonly azureService: AzureDevOpsService,
    private readonly settingsStore: SettingsStore
  ) {
    this.skillsRootDir = join(app.getPath('userData'), 'skills');
    if (!existsSync(this.skillsRootDir)) {
      mkdirSync(this.skillsRootDir, { recursive: true });
    }
  }

  /** Restore missing global skill files from DB content (called at startup). */
  restoreGlobalSkillFiles(): void {
    const globalSkills = this.db.getSkills('global');
    for (const skill of globalSkills) {
      const skillMdPath = join(skill.folderPath, 'SKILL.md');
      if (!existsSync(skillMdPath)) {
        const content = this.db.getSkillContent(skill.id);
        if (content != null) {
          if (!existsSync(skill.folderPath)) {
            mkdirSync(skill.folderPath, { recursive: true });
          }
          writeFileSync(skillMdPath, content, 'utf-8');
        }
      }
    }
  }

  // ─── Query ────────────────────────────────────────────────────

  getAll(scope?: SkillScope, projectKey?: string): SkillInfo[] {
    return this.db.getSkills(scope, projectKey);
  }

  getSkillFiles(skillId: string): SkillFile[] {
    const skill = this.db.getSkills().find((s) => s.id === skillId);
    if (!skill || !existsSync(skill.folderPath)) return [];
    return this.readFolderTree(skill.folderPath, skill.folderPath);
  }

  getSyncStatus(projectKey: string): { lastSyncedAt: string | null; repositoryName?: string } {
    const metaPath = join(this.getProjectDir(projectKey), '_meta.json');
    if (!existsSync(metaPath)) return { lastSyncedAt: null };
    try {
      const meta: SkillMeta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      return { lastSyncedAt: meta.lastSyncedAt, repositoryName: meta.repositoryName };
    } catch {
      return { lastSyncedAt: null };
    }
  }

  getProjectKeys(): string[] {
    return this.db.getSkillProjectKeys();
  }

  getIntegritySummary(): SkillIntegritySummary {
    return this.db.getSkillsIntegritySummary();
  }

  validateAllSkillsIntegrity(): SkillIntegritySummary {
    const now = new Date().toISOString();
    const skills = this.db.getSkills();

    for (const skill of skills) {
      const skillMdPath = join(skill.folderPath, 'SKILL.md');

      if (!existsSync(skill.folderPath)) {
        this.db.updateSkillIntegrity(skill.id, true, 'folder_missing', null, now);
        continue;
      }

      if (!existsSync(skillMdPath)) {
        this.db.updateSkillIntegrity(skill.id, true, 'skill_file_missing', null, now);
        continue;
      }

      const diskContent = readFileSync(skillMdPath, 'utf-8');
      const diskHash = this.computeHash(diskContent);

      const dbContent = this.db.getSkillContent(skill.id);
      const dbContentHash = this.db.getSkillContentHash(skill.id);

      // Bootstrap canonical content for old records that predate project-content persistence.
      if (dbContent == null) {
        this.db.updateSkillCanonicalContent(skill.id, diskContent, diskHash);
        this.db.updateSkillIntegrity(skill.id, false, null, diskHash, now);
        continue;
      }

      const effectiveDbHash = dbContentHash || this.computeHash(dbContent);
      if (!dbContentHash) {
        this.db.updateSkillCanonicalContent(skill.id, dbContent, effectiveDbHash);
      }

      const isMismatched = effectiveDbHash !== diskHash;
      const reason: SkillMismatchReason | null = isMismatched ? 'content_differs' : null;
      this.db.updateSkillIntegrity(skill.id, isMismatched, reason, diskHash, now);
    }

    return this.db.getSkillsIntegritySummary();
  }

  saveAllSkillsToDisk(): SkillDiskSyncResult {
    const skills = this.db.getSkills();
    let savedCount = 0;
    let skippedCount = 0;
    const failed: Array<{ skillId: string; skillName: string; error: string }> = [];

    for (const skill of skills) {
      const content = this.db.getSkillContent(skill.id);
      if (content == null) {
        skippedCount++;
        continue;
      }

      try {
        if (!existsSync(skill.folderPath)) {
          mkdirSync(skill.folderPath, { recursive: true });
        }
        writeFileSync(join(skill.folderPath, 'SKILL.md'), content, 'utf-8');
        savedCount++;
      } catch (err) {
        failed.push({
          skillId: skill.id,
          skillName: skill.name,
          error: err instanceof Error ? err.message : String(err)
        });
      }
    }

    const summary = this.validateAllSkillsIntegrity();
    return { savedCount, skippedCount, failed, summary };
  }

  // ─── Project skill sync ───────────────────────────────────────

  async syncProjectSkills(
    orgName: string,
    projectName: string,
    repositoryId: string,
    repositoryName: string
  ): Promise<SkillSyncResult> {
    const projectKeyCandidates = buildSkillProjectKeyCandidates(orgName, projectName);
    const projectKey = projectKeyCandidates[0];
    if (!projectKey) {
      throw new Error('Cannot sync skills: organization and project names are required.');
    }
    const projectDir = this.getProjectDir(projectKey);
    const errors: string[] = [];
    const now = new Date().toISOString();

    // Resolve default branch
    let defaultBranch: string;
    try {
      defaultBranch = await this.azureService.getDefaultBranch(repositoryId);
    } catch (err) {
      throw new Error(`Failed to resolve default branch: ${err}`);
    }

    // Resolve skills source path from settings
    const sourcePath =
      this.settingsStore.getSettings().skillsSourcePath?.trim() || DEFAULT_SKILLS_SOURCE_PATH;

    // Fetch tree
    const tree = await this.azureService.getRepositoryTree(repositoryId, sourcePath, defaultBranch);
    if (tree.length === 0) {
      // Remote has no skills — clean up local data so deleted remote skills are removed
      this.db.deleteSkillsByProjectKey(projectKey);
      if (existsSync(projectDir)) {
        rmSync(projectDir, { recursive: true, force: true });
      }
      return { projectKey, skillCount: 0, syncedAt: now, errors: [`No skills found at ${sourcePath}`] };
    }

    // Clean previous download
    if (existsSync(projectDir)) {
      // Preserve _meta.json timestamp for comparison
      rmSync(projectDir, { recursive: true, force: true });
    }
    mkdirSync(projectDir, { recursive: true });

    // Normalize sourcePath for prefix stripping.
    // ADO returns paths with a leading '/' (e.g. "/.github/skills/arch/SKILL.md")
    // while the configured sourcePath may be ".github/skills" (no leading slash).
    const normalizedSourcePrefix = sourcePath.startsWith('/')
      ? sourcePath
      : `/${sourcePath}`;

    // Download each file
    const files = tree.filter((item) => !item.isFolder);
    for (const file of files) {
      try {
        const content = await this.azureService.getItemContentFromBranch(
          repositoryId,
          file.path,
          defaultBranch
        );
        // Reconstruct relative path: remove the sourcePath prefix
        // ADO paths start with '/' so we match against the normalized prefix.
        let relPath: string;
        if (file.path.startsWith(normalizedSourcePrefix)) {
          relPath = file.path.slice(normalizedSourcePrefix.length).replace(/^\//, '');
        } else if (file.path.startsWith(sourcePath)) {
          relPath = file.path.slice(sourcePath.length).replace(/^\//, '');
        } else {
          // Fallback: strip leading slash and use as-is
          relPath = file.path.replace(/^\//, '');
        }
        if (!relPath) continue; // skip the root folder entry itself
        const localPath = join(projectDir, ...relPath.split('/').filter(Boolean));
        const dir = join(localPath, '..');
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        writeFileSync(localPath, content, 'utf-8');
      } catch (err) {
        errors.push(`Failed to download ${file.path}: ${err}`);
      }
    }

    // Discover skills (each subfolder with a SKILL.md)
    const discoveredSkills = this.discoverSkillFolders(projectDir);

    // Remove old project skills from DB
    this.db.deleteSkillsByProjectKey(projectKey);

    // Register each skill in DB
    for (const skillFolder of discoveredSkills) {
      const folderName = relative(projectDir, skillFolder).split(/[\\/]/)[0];
      const skillMdPath = join(skillFolder, 'SKILL.md');
      const { name, description } = this.parseSkillMdFrontmatter(skillMdPath);
      const skillName = name || folderName;
      const marker = this.generateMarker(skillName);
      const content = readFileSync(skillMdPath, 'utf-8');
      const contentHash = this.computeHash(content);

      const skill: SkillInfo = {
        id: crypto.randomUUID(),
        name: skillName,
        description: description || '',
        scope: 'project',
        projectKey,
        folderPath: skillFolder,
        isActive: true,
        isHidden: false,
        marker,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now
      };
      this.db.upsertSkill(skill, content, contentHash);
    }

    // Write meta
    const meta: SkillMeta = {
      lastSyncedAt: now,
      repositoryId,
      repositoryName,
      defaultBranch
    };
    writeFileSync(join(projectDir, '_meta.json'), JSON.stringify(meta, null, 2), 'utf-8');

    this.validateAllSkillsIntegrity();

    return {
      projectKey,
      skillCount: discoveredSkills.length,
      syncedAt: now,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  // ─── Global skill CRUD ───────────────────────────────────────

  /** Parse name and description from YAML frontmatter in SKILL.md content. */
  parseNameDescFromContent(content: string): { name: string; description: string } {
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return { name: '', description: '' };
    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    const name = (nameMatch?.[1]?.trim() ?? '').replace(/<[^>]*>/g, '').slice(0, 200);
    const description = (descMatch?.[1]?.trim() ?? '').replace(/<[^>]*>/g, '').slice(0, 500);
    return { name, description };
  }

  saveGlobalSkill(
    name: string,
    description: string,
    content: string,
    linkedOrganizationIds?: string[] | null,
    existingId?: string
  ): SkillInfo {
    const parsed = this.parseNameDescFromContent(content);
    const effectiveName = parsed.name || name || 'Untitled Skill';
    const effectiveDesc = parsed.description || description;

    const now = new Date().toISOString();
    const id = existingId || crypto.randomUUID();
    const sanitizedName = this.sanitizeFolderName(effectiveName);
    const folderPath = join(this.getGlobalDir(), sanitizedName);

    let oldFolderPath: string | null = null;
    let marker: string;
    if (existingId) {
      const existing = this.db.getSkills().find((s) => s.id === existingId);
      if (existing && existing.folderPath !== folderPath) {
        oldFolderPath = existing.folderPath;
      }
      marker = existing?.marker || this.generateMarker(effectiveName);
    } else {
      marker = this.generateMarker(effectiveName);
    }

    if (!existsSync(folderPath)) {
      mkdirSync(folderPath, { recursive: true });
    }

    writeFileSync(join(folderPath, 'SKILL.md'), content, 'utf-8');

    const sanitizedLinkedOrganizationIds = this.sanitizeLinkedOrganizationIds(linkedOrganizationIds);

    const skill: SkillInfo = {
      id,
      name: effectiveName,
      description: effectiveDesc,
      scope: 'global',
      projectKey: null,
      linkedOrganizationIds: sanitizedLinkedOrganizationIds,
      folderPath,
      isActive: true,
      isHidden: false,
      marker,
      lastSyncedAt: null,
      createdAt: now,
      updatedAt: now
    };
    this.db.upsertSkill(skill, content, this.computeHash(content));

    if (oldFolderPath && existsSync(oldFolderPath)) {
      rmSync(oldFolderPath, { recursive: true, force: true });
    }

    this.validateAllSkillsIntegrity();

    return skill;
  }

  deleteGlobalSkill(id: string): void {
    const skill = this.db.getSkills().find((s) => s.id === id);
    if (skill && skill.scope === 'global' && existsSync(skill.folderPath)) {
      rmSync(skill.folderPath, { recursive: true, force: true });
    }
    this.db.deleteSkill(id);
  }

  deleteProjectSkill(id: string): void {
    const skill = this.db.getSkills().find((s) => s.id === id);
    if (skill && skill.scope === 'project' && existsSync(skill.folderPath)) {
      rmSync(skill.folderPath, { recursive: true, force: true });
    }
    this.db.deleteSkill(id);
  }

  toggleSkillHidden(id: string, isHidden: boolean): void {
    this.db.toggleSkillHidden(id, isHidden);
  }

  updateSkillLinkedOrganizations(id: string, linkedOrganizationIds: string[] | null): void {
    this.db.updateSkillLinkedOrganizations(id, this.sanitizeLinkedOrganizationIds(linkedOrganizationIds));
  }

  // ─── Review-time resolution ───────────────────────────────────

  resolveSkillsForReview(
    projectKey: string | null,
    organizationId?: string | null,
    selectedGlobalSkillIds?: string[]
  ): {
    skillDirectories: string[];
    disabledSkills: string[];
    expectedMarkers: Array<{ skillName: string; marker: string }>;
    cleanupTempDirs: () => void;
  } {
    const activeSkills: SkillInfo[] = [];

    if (selectedGlobalSkillIds && selectedGlobalSkillIds.length > 0) {
      const selectedSet = new Set(selectedGlobalSkillIds);
      const allSkills = this.db.getSkills();
      activeSkills.push(...allSkills.filter((s) => s.isActive && !s.isHidden && selectedSet.has(s.id)));
    } else {
      // Include all active, non-hidden project skills
      if (projectKey) {
        const normalizedProjectKey = normalizeSkillProjectKeyForMatch(projectKey);
        const projectSkills = this.db.getSkills('project')
          .filter((skill) => normalizeSkillProjectKeyForMatch(skill.projectKey) === normalizedProjectKey);
        activeSkills.push(...projectSkills.filter((s) => s.isActive && !s.isHidden));
      }
      // Include global skills: those with no linked orgs (available to all) or linked to the current org
      const allGlobalSkills = this.db.getSkills('global');
      for (const s of allGlobalSkills) {
        if (!s.isActive || s.isHidden) continue;
        if (!s.linkedOrganizationIds || s.linkedOrganizationIds.length === 0) {
          activeSkills.push(s);
        } else if (organizationId && s.linkedOrganizationIds.includes(organizationId)) {
          activeSkills.push(s);
        }
      }
    }

    // For each active skill, check if SKILL.md contains the {{SKILL_MARKER}}
    // placeholder. If so, create a temp copy with the placeholder replaced by
    // the actual marker value. Otherwise, use the original directory as-is.
    const skillDirs: string[] = [];
    const tempDirs: string[] = [];
    const expectedMarkers: Array<{ skillName: string; marker: string }> = [];
    const tempRoot = join(tmpdir(), 'chocolatine-skills-' + Date.now());

    for (const skill of activeSkills) {
      const skillMdPath = join(skill.folderPath, 'SKILL.md');
      if (!existsSync(skillMdPath)) continue;

      const originalContent = readFileSync(skillMdPath, 'utf-8');
      const usesMarkerPlaceholder = skill.marker && originalContent.includes(MARKER_PLACEHOLDER);
      if (usesMarkerPlaceholder) {
        expectedMarkers.push({ skillName: skill.name, marker: skill.marker! });
        // Create a temp copy with the placeholder replaced
        const tempSkillDir = join(tempRoot, `${this.sanitizeFolderName(skill.name)}-${skill.id.slice(0, 8)}`);
        try {
          mkdirSync(tempSkillDir, { recursive: true });
          const entries = readdirSync(skill.folderPath);
          for (const entry of entries) {
            const srcPath = join(skill.folderPath, entry);
            const destPath = join(tempSkillDir, entry);
            if (statSync(srcPath).isFile()) {
              if (entry === 'SKILL.md') {
                writeFileSync(destPath, originalContent.replaceAll(MARKER_PLACEHOLDER, skill.marker), 'utf-8');
              } else {
                writeFileSync(destPath, readFileSync(srcPath));
              }
            } else if (statSync(srcPath).isDirectory()) {
              cpSync(srcPath, destPath, { recursive: true });
            }
          }
          skillDirs.push(tempSkillDir);
          tempDirs.push(tempSkillDir);
        } catch (err) {
          console.warn(`[Skills] Failed to create temp copy for ${skill.name}:`, err);
          skillDirs.push(skill.folderPath);
        }
      } else {
        skillDirs.push(skill.folderPath);
      }
    }

    const cleanupTempDirs = (): void => {
      if (tempDirs.length > 0) {
        try {
          rmSync(tempRoot, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    };

    return {
      skillDirectories: skillDirs,
      disabledSkills: [],
      expectedMarkers,
      cleanupTempDirs
    };
  }

  verifyMarkers(response: string, expectedMarkers: Array<{ skillName: string; marker: string }>): SkillMarkerResult[] {
    return expectedMarkers.map(({ skillName, marker }) => ({
      skillName,
      marker,
      found: response.includes(marker)
    }));
  }

  /** Sanitise a name for use in folder names / project keys (public for consumers). */
  sanitizeForKey(name: string): string {
    return this.sanitizeFolderName(name);
  }

  // ─── Private helpers ──────────────────────────────────────────

  private getProjectDir(projectKey: string): string {
    return join(this.skillsRootDir, 'projects', projectKey);
  }

  private getGlobalDir(): string {
    return join(this.skillsRootDir, 'global');
  }

  private sanitizeFolderName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, '-').toLowerCase();
  }

  private computeHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /** Keep only links to currently known organizations. Unknown IDs are dropped. */
  private sanitizeLinkedOrganizationIds(linkedOrganizationIds?: string[] | null): string[] | null {
    if (!linkedOrganizationIds || linkedOrganizationIds.length === 0) {
      return null;
    }
    const knownOrganizationIds = new Set((this.settingsStore.getSettings().organizations ?? []).map((org) => org.id));
    const filtered = Array.from(new Set(linkedOrganizationIds.filter((id) => knownOrganizationIds.has(id))));
    return filtered.length > 0 ? filtered : null;
  }

  private generateMarker(skillName: string): string {
    const suffix = crypto.randomUUID().slice(0, 8).toUpperCase();
    return `${MARKER_PREFIX}${this.sanitizeFolderName(skillName).toUpperCase().replace(/-/g, '_')}_${suffix}`;
  }

  private parseSkillMdFrontmatter(skillMdPath: string): { name: string; description: string } {
    if (!existsSync(skillMdPath)) return { name: '', description: '' };
    const content = readFileSync(skillMdPath, 'utf-8');
    const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!match) return { name: '', description: '' };
    const frontmatter = match[1];
    const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
    const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
    return {
      name: nameMatch?.[1]?.trim() ?? '',
      description: descMatch?.[1]?.trim() ?? ''
    };
  }

  private discoverSkillFolders(rootDir: string): string[] {
    const skillFolders: string[] = [];
    if (!existsSync(rootDir)) return skillFolders;
    const entries = readdirSync(rootDir);
    for (const entry of entries) {
      if (entry.startsWith('_')) continue; // Skip _meta.json folder
      const entryPath = join(rootDir, entry);
      if (!statSync(entryPath).isDirectory()) continue;
      const skillMdPath = join(entryPath, 'SKILL.md');
      if (existsSync(skillMdPath)) {
        skillFolders.push(entryPath);
      }
    }
    return skillFolders;
  }

  private readFolderTree(rootPath: string, basePath: string): SkillFile[] {
    const results: SkillFile[] = [];
    if (!existsSync(rootPath)) return results;
    const entries = readdirSync(rootPath);
    for (const entry of entries) {
      if (entry === '_meta.json') continue;
      const fullPath = join(rootPath, entry);
      const relPath = relative(basePath, fullPath);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        results.push({ path: relPath, isFolder: true });
        results.push(...this.readFolderTree(fullPath, basePath));
      } else {
        let content: string | null = null;
        try {
          content = readFileSync(fullPath, 'utf-8');
        } catch { /* binary or unreadable */ }
        results.push({ path: relPath, isFolder: false, content });
      }
    }
    return results;
  }
}
