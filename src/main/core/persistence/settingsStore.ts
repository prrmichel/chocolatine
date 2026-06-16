import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import {
  AppSettings,
  AdoOrganization,
  AdoOrganizationMetadata,
  AzureDevOpsSettings,
  PrSource,
  PromptCategory,
  SettingsSaveResult
} from '@shared/types/models';
import { getFallbackFreeModelId, normalizeDefaultModelId } from '@shared/constants/modelOptions';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { applyAdoSettingsPolicy } from '@main/core/persistence/adoSettingsPolicy';
import {
  PROTECTED_SECRET_PREFIX,
  isPlaintextSecret,
  isProtectedSecret,
  resolveStoredSecret,
  type StoredSecretState
} from '@main/core/persistence/storedSecret';

/** Shape of settings.json — machine-local values only. */
interface SettingsFile {
  azureDevOps: AzureDevOpsSettings;
  /** Organization PATs by organization ID (local-only, never stored in DB). */
  organizationTokens?: Record<string, string>;

  /** Legacy fields kept only for migration compatibility. */
  organizations?: AdoOrganization[];
  prSources?: PrSource[];
  activePrSourceId?: string | null;
  database?: {
    folderPath?: string | null;
  };
}

type LoadedSettingsFile = SettingsFile & {
  needsSecretRewrite?: boolean;
  legacyPlaintextOrganizationIds?: string[];
  legacyPlaintextAdoPat?: boolean;
};

function protectSecret(secret: string): string {
  if (!secret) {
    return '';
  }
  if (isProtectedSecret(secret)) {
    return secret;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return secret;
  }
  try {
    return `${PROTECTED_SECRET_PREFIX}${safeStorage.encryptString(secret).toString('base64')}`;
  } catch (error) {
    console.warn('[Settings] Failed to encrypt a secret for local storage.', error);
    return secret;
  }
}

function unprotectSecret(secret: string): string {
  if (!secret) {
    return '';
  }
  if (!isProtectedSecret(secret)) {
    return secret;
  }
  if (!safeStorage.isEncryptionAvailable()) {
    return secret;
  }
  try {
    return safeStorage.decryptString(Buffer.from(secret.slice(PROTECTED_SECRET_PREFIX.length), 'base64'));
  } catch (error) {
    console.warn('[Settings] Failed to decrypt a secret from local storage.', error);
    return '';
  }
}

function protectSecretMap(tokens: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(tokens).map(([orgId, token]) => [orgId, protectSecret(token)]));
}

function shouldRewritePlaintextSecrets(parsed: Partial<SettingsFile>): boolean {
  if (isPlaintextSecret(parsed.azureDevOps?.pat)) {
    return true;
  }

  const organizationTokens = parsed.organizationTokens ?? {};
  if (Object.values(organizationTokens).some((token) => isPlaintextSecret(token))) {
    return true;
  }

  if (Array.isArray(parsed.organizations) && parsed.organizations.some((org) => isPlaintextSecret(org.pat))) {
    return true;
  }

  return false;
}

const defaultSettings = (): AppSettings => ({
  azureDevOps: {
    organization: '',
    project: '',
    pat: '',
    apiVersion: '7.1'
  },
  database: {
    folderPath: null
  },
  reviewQueue: {
    maxConcurrentReviews: 1
  },
  reviewStorage: {
    folderPath: null
  },
  promptLibrary: {
    defaultPromptId: null,
    defaultPromptIdByCategory: {},
    prompts: []
  },
  defaultModel: getFallbackFreeModelId(),
  defaultDiffViewMode: 'inline',
  skillsSourcePath: '.github/skills'
});

const normalizePromptLibrary = (promptLibrary: AppSettings['promptLibrary']): AppSettings['promptLibrary'] => {
  const prompts = (promptLibrary?.prompts ?? []).map((prompt) => ({
    ...prompt,
    category: (prompt.category ?? 'PR Review') as PromptCategory
  }));

  const byCategory: Partial<Record<PromptCategory, string>> = {
    ...promptLibrary?.defaultPromptIdByCategory
  };

  const ensureDefaultForCategory = (category: PromptCategory) => {
    const prompt = prompts.find((p) => p.id === byCategory[category] && p.category === category)
      ?? prompts.find((p) => p.category === category);
    if (prompt) {
      byCategory[category] = prompt.id;
    }
  };

  ensureDefaultForCategory('PR Review');
  ensureDefaultForCategory('Work Item changes summary');

  return {
    defaultPromptId: promptLibrary?.defaultPromptId ?? byCategory['PR Review'] ?? prompts[0]?.id ?? null,
    defaultPromptIdByCategory: byCategory,
    prompts
  };
};

export class SettingsStore {
  private settingsPath: string;
  private ado: AzureDevOpsSettings;
  private organizationTokens: Record<string, string>;
  private legacyPlaintextOrganizationIds: Set<string>;
  private legacyPlaintextAdoPat: boolean;
  private needsSecretRewrite: boolean;
  private pendingSettingsFileWrite: boolean;
  /** Local fallback cache used before DB is ready and for seeding DB on first run after migration. */
  private fileOrganizationsSeed: AdoOrganizationMetadata[];
  /** Local fallback cache used before DB is ready and for seeding DB on first run after migration. */
  private filePrSourcesSeed: PrSource[];
  private fileActivePrSourceId: string | null;
  private databaseFolderPath: string | null;
  private database: DatabaseService | null = null;

  constructor() {
    const dir = join(app.getPath('userData'), 'config');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.settingsPath = join(dir, 'settings.json');
    const loaded = this.loadSettingsFile();
    this.ado = loaded.azureDevOps;
    this.organizationTokens = loaded.organizationTokens ?? {};
    this.legacyPlaintextOrganizationIds = new Set(loaded.legacyPlaintextOrganizationIds ?? []);
    this.legacyPlaintextAdoPat = Boolean(loaded.legacyPlaintextAdoPat);
    this.needsSecretRewrite = Boolean(loaded.needsSecretRewrite);
    this.pendingSettingsFileWrite = this.needsSecretRewrite;
    this.fileOrganizationsSeed = (loaded.organizations ?? []).map((org) => ({ id: org.id, name: org.name }));
    this.filePrSourcesSeed = loaded.prSources ?? [];
    this.fileActivePrSourceId = loaded.activePrSourceId ?? null;
    this.databaseFolderPath = loaded.database?.folderPath?.trim() ? loaded.database.folderPath.trim() : null;

    // Auto-migrate legacy single-org config into organization metadata + PR source seed.
    this.migrateFromLegacy();
  }

  finalizeProtectedSettingsPersistence(): void {
    if (!this.pendingSettingsFileWrite && !this.needsSecretRewrite) {
      return;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      return;
    }
    this.writeSettingsFile(this.databaseFolderPath);
    this.pendingSettingsFileWrite = false;
    this.needsSecretRewrite = false;
  }

  getConfiguredDatabaseFolderPath(): string | null {
    return this.databaseFolderPath;
  }

  /** Must be called after DatabaseService is created. */
  setDatabase(db: DatabaseService): void {
    this.database = db;
    this.seedDbAdoMetadataFromLocalFile();
  }

  getSettings(): AppSettings {
    return this.buildSettings(false);
  }

  getRendererSettings(): AppSettings {
    return this.buildSettings(true);
  }

  getAzureDevOpsRuntimeAccess(sourceIdOverride?: string | null): { settings: AzureDevOpsSettings; credentialError: string | null } {
    const apiVersion = this.database?.getPreference('adoApiVersion') ?? (this.ado.apiVersion || '7.1');
    const activeSourceId = sourceIdOverride ?? this.getCurrentActivePrSourceId();
    const prSources = this.getCurrentPrSources();
    const orgMetadata = this.getCurrentOrganizationMetadata();
    const activeSource = activeSourceId ? prSources.find((source) => source.id === activeSourceId) : undefined;
    const activeOrganization = activeSource
      ? orgMetadata.find((organization) => organization.id === activeSource.organizationId)
      : undefined;

    if (activeSource && activeOrganization) {
      const resolution = this.resolveStoredToken(this.organizationTokens[activeOrganization.id], this.legacyPlaintextOrganizationIds.has(activeOrganization.id));
      return {
        settings: {
          organization: activeOrganization.name,
          project: activeSource.project,
          pat: resolution.value,
          apiVersion
        },
        credentialError: this.buildCredentialAccessError(resolution.state)
      };
    }

    const legacyResolution = this.resolveStoredToken(this.ado.pat, this.legacyPlaintextAdoPat);
    return {
      settings: {
        organization: this.ado.organization,
        project: this.ado.project,
        pat: legacyResolution.value,
        apiVersion
      },
      credentialError: this.buildCredentialAccessError(legacyResolution.state)
    };
  }

  private buildSettings(redactSecrets: boolean): AppSettings {
    const dbSettings = this.database?.loadNonAdoSettings() ?? {};
    const promptLibrary = this.database?.getPromptLibrary() ?? defaultSettings().promptLibrary;

    const orgMetadata = this.getCurrentOrganizationMetadata();
    const prSources = this.getCurrentPrSources();
    const activePrSourceId = this.getCurrentActivePrSourceId();
    const organizations: AdoOrganization[] = orgMetadata.map((org) => ({
      id: org.id,
      name: org.name,
      pat: redactSecrets ? '' : this.resolveStoredToken(this.organizationTokens[org.id], this.legacyPlaintextOrganizationIds.has(org.id)).value,
      hasStoredPat: Boolean(this.organizationTokens[org.id])
    }));

    const apiVersion = this.database?.getPreference('adoApiVersion') ?? (this.ado.apiVersion || '7.1');
    const source = activePrSourceId ? prSources.find((item) => item.id === activePrSourceId) : undefined;
    const org = source ? organizations.find((item) => item.id === source.organizationId) : undefined;
    const resolvedAdo = source && org
      ? {
          organization: org.name,
          project: source.project,
          pat: redactSecrets ? '' : org.pat,
          apiVersion
        }
      : {
          organization: this.ado.organization,
          project: this.ado.project,
          pat: redactSecrets ? '' : this.resolveStoredToken(this.ado.pat, this.legacyPlaintextAdoPat).value,
          apiVersion
        };

    return {
      azureDevOps: resolvedAdo,
      organizations,
      prSources,
      activePrSourceId,
      database: { folderPath: this.databaseFolderPath },
      reviewQueue: dbSettings.reviewQueue ?? defaultSettings().reviewQueue,
      reviewStorage: dbSettings.reviewStorage ?? defaultSettings().reviewStorage,
      promptLibrary: normalizePromptLibrary(promptLibrary),
      defaultModel: normalizeDefaultModelId(dbSettings.defaultModel ?? defaultSettings().defaultModel),
      defaultDiffViewMode: dbSettings.defaultDiffViewMode ?? defaultSettings().defaultDiffViewMode,
      myDisplayName: dbSettings.myDisplayName ?? null,
      skillsSourcePath: dbSettings.skillsSourcePath ?? defaultSettings().skillsSourcePath
    };
  }

  /** Set the active PR source and persist. */
  setActivePrSource(id: string | null): void {
    this.fileActivePrSourceId = id;
    this.database?.setPreference('activePrSourceId', id ?? null);
    this.saveSettingsFile(this.databaseFolderPath);
  }

  /** Get the repository filter for the active PR source, if any. */
  getActivePrSourceRepository(): string | null {
    const activeSourceId = this.database?.getPreference('activePrSourceId') ?? this.fileActivePrSourceId;
    if (!activeSourceId) return null;
    const prSources = this.database?.getPrSources() ?? this.filePrSourcesSeed;
    const source = prSources.find((s) => s.id === activeSourceId);
    return source?.repository?.trim() || null;
  }

  /** Test an organization-level connection (validates PAT against org without needing a project). */
  async testOrgConnection(orgName: string, pat: string): Promise<{ ok: boolean; message: string }> {
    try {
      if (!orgName || !pat) {
        return { ok: false, message: 'Organization name and PAT are required.' };
      }
      const url = `https://dev.azure.com/${encodeURIComponent(orgName)}/_apis/projects?api-version=7.1&$top=1`;
      const headers = {
        Authorization: `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        Accept: 'application/json'
      };
      const response = await fetch(url, { headers });
      if (response.ok) {
        return { ok: true, message: 'Connected successfully.' };
      }
      if (response.status === 401 || response.status === 403) {
        return { ok: false, message: 'Authentication failed — check your PAT.' };
      }
      return { ok: false, message: `Azure DevOps connection failed (HTTP ${response.status}).` };
    } catch (err: unknown) {
      console.warn('[Settings] Azure DevOps organization connection test failed.', err);
      return { ok: false, message: 'Unable to test the Azure DevOps connection right now.' };
    }
  }

  async testStoredOrgConnection(orgId: string, orgNameOverride?: string): Promise<{ ok: boolean; message: string }> {
    const organization = this.getCurrentOrganizationMetadata().find((item) => item.id === orgId);
    if (!organization) {
      return { ok: false, message: 'Azure DevOps organization not found.' };
    }
    const resolution = this.resolveStoredToken(this.organizationTokens[orgId], this.legacyPlaintextOrganizationIds.has(orgId));
    if (!resolution.value) {
      return { ok: false, message: this.buildCredentialAccessError(resolution.state) ?? 'Azure DevOps PAT is missing. Open Settings.' };
    }
    return this.testOrgConnection(orgNameOverride?.trim() || organization.name, resolution.value);
  }

  saveSettings(settings: AppSettings): SettingsSaveResult {
    const normalized: AppSettings = {
      ...settings,
      defaultModel: normalizeDefaultModelId(settings.defaultModel)
    };

    const policyResult = applyAdoSettingsPolicy({
      currentOrganizations: this.getCurrentOrganizationMetadata(),
      currentOrganizationTokens: this.organizationTokens,
      currentPrSources: this.getCurrentPrSources(),
      requestedOrganizations: normalized.organizations ?? [],
      requestedPrSources: normalized.prSources ?? [],
      requestedActivePrSourceId: normalized.activePrSourceId ?? this.fileActivePrSourceId,
      protectedStorageAvailable: safeStorage.isEncryptionAvailable()
    });

    this.organizationTokens = policyResult.organizationTokens;
    this.fileOrganizationsSeed = policyResult.organizations;
    this.filePrSourcesSeed = policyResult.prSources;
    this.fileActivePrSourceId = policyResult.activePrSourceId;
    this.databaseFolderPath = normalized.database?.folderPath?.trim() ? normalized.database.folderPath.trim() : null;
    this.ado = this.buildLegacyAdoSettings(policyResult.activePrSourceId, normalized.azureDevOps.apiVersion || '7.1');
    this.saveSettingsFile(this.databaseFolderPath);

    // Everything non-sensitive → DB
    if (this.database) {
      this.database.saveAdoOrganizations(policyResult.organizations);
      this.database.savePrSources(policyResult.prSources);
      this.database.setPreference('activePrSourceId', policyResult.activePrSourceId ?? null);
      this.database.setPreference('adoApiVersion', normalized.azureDevOps.apiVersion || '7.1');
      this.database.saveNonAdoSettings(normalized);
      this.database.savePromptLibrary(normalized.promptLibrary);
    }

    return {
      settings: this.getRendererSettings(),
      status: policyResult.issues.length > 0 ? 'partial' : 'success',
      message: policyResult.message,
      issues: policyResult.issues
    };
  }

  updateSettings(partial: Partial<AppSettings>): SettingsSaveResult {
    const current = this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...partial,
      azureDevOps: {
        ...current.azureDevOps,
        ...partial.azureDevOps
      },
      organizations: partial.organizations ?? current.organizations,
      prSources: partial.prSources ?? current.prSources,
      activePrSourceId: partial.activePrSourceId !== undefined ? partial.activePrSourceId : current.activePrSourceId,
      reviewQueue: {
        ...current.reviewQueue,
        ...partial.reviewQueue
      },
      reviewStorage: {
        ...(current.reviewStorage ?? { folderPath: null }),
        ...(partial.reviewStorage ?? {})
      },
      database: {
        ...(current.database ?? { folderPath: null }),
        ...(partial.database ?? {})
      },
      promptLibrary: partial.promptLibrary ?? current.promptLibrary,
      defaultModel: normalizeDefaultModelId(partial.defaultModel ?? current.defaultModel),
      defaultDiffViewMode: partial.defaultDiffViewMode ?? current.defaultDiffViewMode,
      myDisplayName: partial.myDisplayName !== undefined ? partial.myDisplayName : current.myDisplayName,
      skillsSourcePath: partial.skillsSourcePath ?? current.skillsSourcePath
    };
    return this.saveSettings(merged);
  }

  /** Read the legacy full settings.json (used for file→DB migration). */
  readLegacySettingsFile(): AppSettings | null {
    if (!existsSync(this.settingsPath)) {
      return null;
    }
    try {
      const raw = readFileSync(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as AppSettings;
      const organizations = Array.isArray(parsed.organizations)
        ? parsed.organizations.map((org) => ({ ...org, pat: unprotectSecret(org.pat ?? '') }))
        : parsed.organizations;
      return {
        ...defaultSettings(),
        ...parsed,
        azureDevOps: {
          ...defaultSettings().azureDevOps,
          ...parsed.azureDevOps,
          pat: unprotectSecret(parsed.azureDevOps?.pat ?? '')
        },
        organizations,
        defaultModel: normalizeDefaultModelId(parsed.defaultModel)
      };
    } catch {
      return null;
    }
  }

  private loadSettingsFile(): LoadedSettingsFile {
    if (!existsSync(this.settingsPath)) {
      const defaults = defaultSettings();
      const initial: SettingsFile = {
        azureDevOps: defaults.azureDevOps,
        organizationTokens: {},
        activePrSourceId: null,
        database: { folderPath: null }
      };
      writeFileSync(this.settingsPath, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }

    try {
      const raw = readFileSync(this.settingsPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<SettingsFile>;
      const ado = parsed?.azureDevOps ?? {};
      const rawOrganizationTokens = {
        ...(parsed?.organizationTokens ?? {}),
        ...(Array.isArray(parsed?.organizations)
          ? Object.fromEntries(parsed.organizations.map((org) => [org.id, org.pat ?? '']))
          : {})
      };
      return {
        azureDevOps: {
          organization: ado.organization ?? '',
          project: ado.project ?? '',
          pat: ado.pat ?? '',
          apiVersion: ado.apiVersion ?? '7.1'
        },
        organizationTokens: rawOrganizationTokens,
        organizations: Array.isArray(parsed?.organizations)
          ? parsed.organizations.map((org) => ({ id: org.id, name: org.name, pat: '' }))
          : [],
        prSources: Array.isArray(parsed?.prSources) ? parsed.prSources : [],
        activePrSourceId: parsed?.activePrSourceId ?? null,
        database: {
          folderPath: parsed?.database?.folderPath ?? null
        },
        needsSecretRewrite: shouldRewritePlaintextSecrets(parsed),
        legacyPlaintextOrganizationIds: Object.entries(rawOrganizationTokens)
          .filter(([, token]) => isPlaintextSecret(token))
          .map(([orgId]) => orgId),
        legacyPlaintextAdoPat: isPlaintextSecret(ado.pat)
      };
    } catch {
      const defaults = defaultSettings();
      const fallback: SettingsFile = {
        azureDevOps: defaults.azureDevOps,
        organizationTokens: {},
        activePrSourceId: null,
        database: { folderPath: null }
      };
      writeFileSync(this.settingsPath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
  }

  private saveSettingsFile(databaseFolderPath: string | null): void {
    if (!safeStorage.isEncryptionAvailable() && !app.isReady()) {
      this.pendingSettingsFileWrite = true;
      return;
    }
    if (!safeStorage.isEncryptionAvailable() && this.hasUnsafePlaintextSecrets()) {
      this.pendingSettingsFileWrite = true;
      return;
    }
    this.writeSettingsFile(databaseFolderPath);
    this.pendingSettingsFileWrite = false;
    this.needsSecretRewrite = false;
  }

  private writeSettingsFile(databaseFolderPath: string | null): void {
    const legacyAdo = this.buildLegacyAdoSettings(this.fileActivePrSourceId, this.ado.apiVersion || '7.1');
    const file: SettingsFile = {
      azureDevOps: {
        ...legacyAdo,
        pat: protectSecret(legacyAdo.pat ?? '')
      },
      organizationTokens: protectSecretMap(this.organizationTokens),
      activePrSourceId: this.fileActivePrSourceId,
      database: {
        folderPath: databaseFolderPath
      }
    };
    writeFileSync(this.settingsPath, JSON.stringify(file, null, 2), 'utf-8');
    this.ado = file.azureDevOps;
    this.organizationTokens = file.organizationTokens ?? {};
    this.legacyPlaintextOrganizationIds.clear();
    this.legacyPlaintextAdoPat = false;
  }

  /** Auto-migrate legacy single-org config into local seed metadata. */
  private migrateFromLegacy(): void {
    if (this.fileOrganizationsSeed.length > 0 || !this.ado.organization) return;

    const orgId = `org-${Date.now()}`;
    const sourceId = `src-${Date.now()}`;

    this.fileOrganizationsSeed = [{ id: orgId, name: this.ado.organization }];
    this.organizationTokens[orgId] = this.ado.pat ?? '';

    if (this.ado.project) {
      this.filePrSourcesSeed = [{
        id: sourceId,
        name: `${this.ado.organization}/${this.ado.project}`,
        organizationId: orgId,
        project: this.ado.project,
        repository: null
      }];
      this.fileActivePrSourceId = sourceId;
    }

    this.saveSettingsFile(this.databaseFolderPath);
  }

  /** Seed DB organization/source metadata from local file if DB is empty. */
  private seedDbAdoMetadataFromLocalFile(): void {
    if (!this.database) return;

    const dbOrganizations = this.database.getAdoOrganizations();
    if (dbOrganizations.length === 0 && this.fileOrganizationsSeed.length > 0) {
      this.database.saveAdoOrganizations(this.fileOrganizationsSeed);
    }

    const organizationIds = new Set(this.database.getAdoOrganizations().map((org) => org.id));
    const dbPrSources = this.database.getPrSources();
    if (dbPrSources.length === 0 && this.filePrSourcesSeed.length > 0) {
      const validSources = this.filePrSourcesSeed.filter((source) => organizationIds.has(source.organizationId));
      this.database.savePrSources(validSources);
    }

    const activePrSourceId = this.database.getPreference('activePrSourceId');
    if (!activePrSourceId && this.fileActivePrSourceId) {
      this.database.setPreference('activePrSourceId', this.fileActivePrSourceId);
    }

    // Rewrite local settings file into the new shape without legacy metadata arrays.
    this.saveSettingsFile(this.databaseFolderPath);
  }

  private getCurrentOrganizationMetadata(): AdoOrganizationMetadata[] {
    return this.database?.getAdoOrganizations() ?? this.fileOrganizationsSeed;
  }

  private getCurrentPrSources(): PrSource[] {
    return this.database?.getPrSources() ?? this.filePrSourcesSeed;
  }

  private getCurrentActivePrSourceId(): string | null {
    return this.database?.getPreference('activePrSourceId') ?? this.fileActivePrSourceId;
  }

  private resolveStoredToken(secret: string | undefined | null, isLegacyPlaintext: boolean) {
    return resolveStoredSecret(secret, {
      encryptionAvailable: safeStorage.isEncryptionAvailable(),
      isLegacyPlaintext,
      decrypt: (encodedSecret) => safeStorage.decryptString(Buffer.from(encodedSecret, 'base64'))
    });
  }

  private buildCredentialAccessError(state: StoredSecretState): string | null {
    switch (state) {
      case 'protected-storage-unavailable':
        return 'Azure DevOps PAT is stored securely, but protected storage is unavailable right now. Open Settings.';
      case 'decrypt-failed':
        return 'Azure DevOps PAT could not be read from protected storage. Open Settings and re-enter it.';
      case 'legacy-plaintext-blocked':
        return 'A legacy plaintext Azure DevOps PAT was detected, but protected storage is unavailable. Open Settings and save the PAT again once protected storage is available.';
      default:
        return null;
    }
  }

  private buildLegacyAdoSettings(activePrSourceId: string | null, apiVersion: string): AzureDevOpsSettings {
    const source = activePrSourceId ? this.filePrSourcesSeed.find((item) => item.id === activePrSourceId) : undefined;
    const organization = source ? this.fileOrganizationsSeed.find((item) => item.id === source.organizationId) : undefined;
    if (source && organization) {
      return {
        organization: organization.name,
        project: source.project,
        pat: this.organizationTokens[organization.id] ?? '',
        apiVersion
      };
    }
    return {
      ...this.ado,
      apiVersion
    };
  }

  private hasUnsafePlaintextSecrets(): boolean {
    if (isPlaintextSecret(this.ado.pat)) {
      return true;
    }
    return Object.values(this.organizationTokens).some((token) => isPlaintextSecret(token));
  }
}
