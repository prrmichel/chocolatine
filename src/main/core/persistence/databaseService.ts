import Database, { Database as DatabaseType } from 'better-sqlite3';
import { app } from 'electron';
import { copyFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { dirname, isAbsolute, join, resolve } from 'path';
import {
  AdoOrganizationMetadata,
  AppSettings,
  CopilotReviewResult,
  FollowUpContext,
  FollowUpContextSummary,
  PromptCategory,
  PromptLibrarySettings,
  PromptTemplate,
  PrSource,
  PullRequestSummary,
  ReviewJob,
  ReviewSessionOptions,
  SkillInfo,
  SkillIntegritySummary,
  SkillMismatchInfo,
  SkillMismatchReason,
  SkillScope
} from '@shared/types/models';
import { normalizeDefaultModelId, normalizeSelectableModelId } from '@shared/constants/modelOptions';
import { parseReviewResponse } from '@main/utils/parseReview';

const SCHEMA_VERSION = 18;

export class DatabaseService {
  private db: DatabaseType;
  private dbPath: string;

  constructor(folderPath?: string | null) {
    const dir = this.resolveFolderPath(folderPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    this.dbPath = join(dir, 'app.db');
    this.db = this.openDatabase(this.dbPath);
  }

  close(): void {
    try {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    } catch {
      // Best-effort checkpoint during shutdown.
    }
    this.db.close();
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  getDatabaseFolderPath(): string {
    return dirname(this.dbPath);
  }

  relocateDatabase(folderPath?: string | null): boolean {
    const targetDir = this.resolveFolderPath(folderPath);
    const targetDbPath = join(targetDir, 'app.db');
    if (targetDbPath === this.dbPath) {
      return false;
    }

    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true });
    }

    const oldDbPath = this.dbPath;
    const oldWalPath = `${oldDbPath}-wal`;
    const oldShmPath = `${oldDbPath}-shm`;
    const targetWalPath = `${targetDbPath}-wal`;
    const targetShmPath = `${targetDbPath}-shm`;

    // Flush WAL before moving
    try { this.db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* ignore */ }
    this.db.close();

    try {
      if (existsSync(targetDbPath)) {
        // Target DB already exists: use it as-is without moving anything
        this.dbPath = targetDbPath;
        this.db = this.openDatabase(this.dbPath);
        return true;
      }

      this.moveFileIfExists(oldDbPath, targetDbPath);
      this.moveFileIfExists(oldWalPath, targetWalPath);
      this.moveFileIfExists(oldShmPath, targetShmPath);

      this.dbPath = targetDbPath;
      this.db = this.openDatabase(this.dbPath);
      return true;
    } catch (error) {
      // Ensure service remains usable if move failed
      this.dbPath = oldDbPath;
      this.db = this.openDatabase(this.dbPath);
      throw error;
    }
  }

  // ─── Schema migration ────────────────────────────────────────────

  private migrate(): void {
    let version = this.db.pragma('user_version', { simple: true }) as number;

    if (version < 1) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS preferences (
          key   TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS prompt_templates (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          category   TEXT NOT NULL DEFAULT 'PR Review',
          content    TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS prompt_settings (
          key   TEXT PRIMARY KEY,
          value TEXT
        );

        CREATE TABLE IF NOT EXISTS review_jobs (
          id                TEXT PRIMARY KEY,
          pr_id             INTEGER NOT NULL,
          pr_repo           TEXT NOT NULL,
          pr_json           TEXT NOT NULL,
          task_type         TEXT,
          prompt            TEXT NOT NULL DEFAULT '',
          model_name        TEXT,
          status            TEXT NOT NULL DEFAULT 'Queued',
          progress_percent  INTEGER NOT NULL DEFAULT 0,
          review_response   TEXT,
          error_message     TEXT,
          queued_at         TEXT,
          started_at        TEXT,
          completed_at      TEXT,
          hidden_in_queue   INTEGER NOT NULL DEFAULT 0,
          review_session_options TEXT,
          effective_context_mode TEXT,
          fallback_reason   TEXT,
          attempt_usage_summary TEXT,
          parsed_review_result TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_review_jobs_pr
          ON review_jobs (pr_id, pr_repo);
        CREATE INDEX IF NOT EXISTS idx_review_jobs_created
          ON review_jobs (created_at);

        CREATE TABLE IF NOT EXISTS follow_up_contexts (
          id                TEXT PRIMARY KEY,
          pr_id             INTEGER NOT NULL,
          pr_repo           TEXT NOT NULL,
          pr_json           TEXT NOT NULL,
          review_job_id     TEXT,
          name              TEXT NOT NULL DEFAULT '',
          model_name        TEXT NOT NULL DEFAULT 'Auto',
          initial_prompt    TEXT NOT NULL DEFAULT '',
          initial_response  TEXT NOT NULL DEFAULT '',
          message_count     INTEGER NOT NULL DEFAULT 0,
          is_streaming      INTEGER NOT NULL DEFAULT 0,
          review_session_options TEXT,
          effective_context_mode TEXT,
          fallback_reason   TEXT,
          created_at        TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_follow_up_pr
          ON follow_up_contexts (pr_id, pr_repo);
        CREATE INDEX IF NOT EXISTS idx_follow_up_review_job
          ON follow_up_contexts (review_job_id);
        CREATE INDEX IF NOT EXISTS idx_follow_up_created
          ON follow_up_contexts (created_at);

        CREATE TABLE IF NOT EXISTS follow_up_messages (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          context_id  TEXT NOT NULL REFERENCES follow_up_contexts(id) ON DELETE CASCADE,
          role        TEXT NOT NULL,
          content     TEXT NOT NULL DEFAULT '',
          model_name  TEXT,
          timestamp   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_follow_up_messages_ctx
          ON follow_up_messages (context_id);
      `);
      this.db.pragma(`user_version = 1`);
      version = 1;
    }

    if (version < 2) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS copilot_sessions (
          context_key  TEXT PRIMARY KEY,
          session_id   TEXT NOT NULL UNIQUE,
          scope        TEXT NOT NULL DEFAULT 'review',
          pr_id        INTEGER,
          pr_repo      TEXT,
          model_name   TEXT,
          created_at   TEXT NOT NULL DEFAULT (datetime('now')),
          last_used    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_copilot_sessions_pr
          ON copilot_sessions (pr_id, pr_repo);
        CREATE INDEX IF NOT EXISTS idx_copilot_sessions_scope
          ON copilot_sessions (scope);
      `);
      this.db.pragma(`user_version = 2`);
      version = 2;
    }

    if (version < 3) {
      this.db.exec(`
        ALTER TABLE review_jobs ADD COLUMN review_history TEXT;
      `);
      this.db.pragma(`user_version = 3`);
      version = 3;
    }

    if (version < 4) {
      this.db.exec(`
        ALTER TABLE review_jobs ADD COLUMN last_sent_prompt TEXT;
      `);
      this.db.pragma(`user_version = 4`);
      version = 4;
    }

    if (version < 5) {
      this.db.exec(`
        ALTER TABLE review_jobs ADD COLUMN is_re_review INTEGER DEFAULT 0;
        ALTER TABLE review_jobs ADD COLUMN session_key TEXT;
      `);
      this.db.pragma(`user_version = 5`);
      version = 5;
    }

    if (version < 6) {
      this.db.pragma(`user_version = 6`);
      version = 6;
    }

    if (version < 7) {
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_review_jobs_status
          ON review_jobs (status);
        CREATE INDEX IF NOT EXISTS idx_follow_up_messages_ctx_ts
          ON follow_up_messages (context_id, timestamp);
      `);
      this.db.pragma(`user_version = 7`);
      version = 7;
    }

    if (version < 8) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS skills (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          description     TEXT NOT NULL DEFAULT '',
          scope           TEXT NOT NULL DEFAULT 'global',
          project_key     TEXT,
          folder_path     TEXT NOT NULL,
          is_active       INTEGER NOT NULL DEFAULT 1,
          marker          TEXT NOT NULL DEFAULT '',
          last_synced_at  TEXT,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_skills_scope
          ON skills (scope);
        CREATE INDEX IF NOT EXISTS idx_skills_project_key
          ON skills (project_key);
      `);
      this.db.pragma('user_version = 8');
      version = 8;
    }

    if (version < 9) {
      this.db.exec(`
        ALTER TABLE skills ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE skills ADD COLUMN content TEXT;
      `);
      this.db.pragma('user_version = 9');
      version = 9;
    }

    if (version < 10) {
      // Migration v10 was previously renaming global→organization. Now we revert that.
      // If DB was already migrated to 'organization', rename back to 'global'.
      this.db.exec(`UPDATE skills SET scope = 'global' WHERE scope = 'organization';`);
      this.db.pragma('user_version = 10');
      version = 10;
    }

    if (version < 11) {
      // Add column for linking global skills to specific organizations (JSON array of org IDs)
      this.db.exec(`ALTER TABLE skills ADD COLUMN linked_organization_ids TEXT;`);
      this.db.pragma('user_version = 11');
      version = 11;
    }

    if (version < 12) {
      this.db.exec(`
        ALTER TABLE skills ADD COLUMN content_hash TEXT;
        ALTER TABLE skills ADD COLUMN disk_hash TEXT;
        ALTER TABLE skills ADD COLUMN is_mismatched INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE skills ADD COLUMN mismatch_reason TEXT;
        ALTER TABLE skills ADD COLUMN last_validation_at TEXT;
      `);
      this.db.pragma('user_version = 12');
      version = 12;
    }

    if (version < 13) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS ado_organizations (
          id         TEXT PRIMARY KEY,
          name       TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS ado_pr_sources (
          id              TEXT PRIMARY KEY,
          name            TEXT NOT NULL,
          organization_id TEXT NOT NULL REFERENCES ado_organizations(id) ON DELETE CASCADE,
          project         TEXT NOT NULL,
          repository      TEXT,
          created_at      TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_ado_pr_sources_org
          ON ado_pr_sources (organization_id);
      `);
      this.db.pragma('user_version = 13');
      version = 13;
    }

    if (version < 14) {
      this.addColumnIfMissing('review_jobs', 'skill_marker_results', 'TEXT');
      this.db.pragma('user_version = 14');
      version = 14;
    }

    if (version < 15) {
      this.addColumnIfMissing('review_jobs', 'parsed_review_result', 'TEXT');
      this.backfillPersistedReviewSummaries();
      this.db.pragma('user_version = 15');
      version = 15;
    }

    if (version < 16) {
      this.addColumnIfMissing('follow_up_contexts', 'message_count', 'INTEGER NOT NULL DEFAULT 0');
      this.backfillFollowUpMetadata();
      this.db.pragma('user_version = 16');
      version = 16;
    }

    if (version < 17) {
      this.addColumnIfMissing('review_jobs', 'review_session_options', 'TEXT');
      this.addColumnIfMissing('review_jobs', 'effective_context_mode', 'TEXT');
      this.addColumnIfMissing('review_jobs', 'fallback_reason', 'TEXT');
      this.addColumnIfMissing('follow_up_contexts', 'review_session_options', 'TEXT');
      this.addColumnIfMissing('follow_up_contexts', 'effective_context_mode', 'TEXT');
      this.addColumnIfMissing('follow_up_contexts', 'fallback_reason', 'TEXT');
      this.db.pragma('user_version = 17');
      version = 17;
    }

    if (version < 18) {
      this.addColumnIfMissing('review_jobs', 'attempt_usage_summary', 'TEXT');
      this.db.pragma('user_version = 18');
      version = 18;
    }

    // Repair review_jobs schema drift for databases whose user_version advanced
    // even though one or more late-added columns are missing.
    let repaired = false;
    repaired = this.addColumnIfMissing('review_jobs', 'review_history', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'last_sent_prompt', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'is_re_review', 'INTEGER DEFAULT 0') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'session_key', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'skill_marker_results', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'parsed_review_result', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'review_session_options', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'effective_context_mode', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'fallback_reason', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('review_jobs', 'attempt_usage_summary', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('follow_up_contexts', 'message_count', 'INTEGER NOT NULL DEFAULT 0') || repaired;
    repaired = this.addColumnIfMissing('follow_up_contexts', 'review_session_options', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('follow_up_contexts', 'effective_context_mode', 'TEXT') || repaired;
    repaired = this.addColumnIfMissing('follow_up_contexts', 'fallback_reason', 'TEXT') || repaired;

    if (version !== SCHEMA_VERSION || repaired) {
      if (repaired) {
        this.backfillPersistedReviewSummaries();
        this.backfillFollowUpMetadata();
      }
      this.db.pragma(`user_version = ${SCHEMA_VERSION}`);
    }
  }

  private hasColumn(tableName: string, columnName: string): boolean {
    const rows = this.db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
    return rows.some((row) => row.name === columnName);
  }

  private addColumnIfMissing(tableName: string, columnName: string, columnDefinition: string): boolean {
    if (this.hasColumn(tableName, columnName)) {
      return false;
    }

    this.db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
    return true;
  }

  private backfillPersistedReviewSummaries(): void {
    const rows = this.db.prepare(`
      SELECT id, task_type, review_response, parsed_review_result
      FROM review_jobs
    `).all() as Array<{
      id: string;
      task_type: string | null;
      review_response: string | null;
      parsed_review_result: string | null;
    }>;

    const update = this.db.prepare(`
      UPDATE review_jobs
      SET prompt = '',
          review_response = ?,
          review_history = NULL,
          last_sent_prompt = NULL,
          parsed_review_result = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    this.db.transaction(() => {
      for (const row of rows) {
        const parsedResult = row.parsed_review_result
          ? row.parsed_review_result
          : (() => {
              const parsed = parseReviewResponse(row.review_response);
              return parsed ? JSON.stringify(parsed) : null;
            })();
        const keepRawResponse = row.task_type === 'Changes summary' || !parsedResult;
        update.run(
          keepRawResponse ? row.review_response : null,
          parsedResult,
          now,
          row.id
        );
      }
    })();
  }

  private backfillFollowUpMetadata(): void {
    const counts = new Map<string, number>();
    const countRows = this.db.prepare(`
      SELECT context_id, COUNT(*) as message_count
      FROM follow_up_messages
      GROUP BY context_id
    `).all() as Array<{ context_id: string; message_count: number }>;

    for (const row of countRows) {
      counts.set(row.context_id, row.message_count);
    }

    const rows = this.db.prepare('SELECT id FROM follow_up_contexts').all() as Array<{ id: string }>;
    const update = this.db.prepare(`
      UPDATE follow_up_contexts
      SET initial_prompt = '',
          initial_response = '',
          message_count = ?,
          updated_at = ?
      WHERE id = ?
    `);

    const now = new Date().toISOString();
    this.db.transaction(() => {
      for (const row of rows) {
        update.run(counts.get(row.id) ?? 0, now, row.id);
      }
      this.db.prepare('DELETE FROM follow_up_messages').run();
    })();
  }

  private resolveFolderPath(folderPath?: string | null): string {
    const configured = folderPath?.trim();
    if (configured) {
      if (!isAbsolute(configured)) {
        throw new Error('Database folder path must be an absolute path.');
      }

      const resolvedPath = resolve(configured);
      if (existsSync(resolvedPath) && !statSync(resolvedPath).isDirectory()) {
        throw new Error('Database folder path must point to a directory.');
      }

      return resolvedPath;
    }
    return join(app.getPath('userData'), 'data');
  }

  private openDatabase(path: string): DatabaseType {
    const db = new Database(path);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    this.db = db;
    this.migrate();
    return db;
  }

  private moveFileIfExists(source: string, target: string): void {
    if (!existsSync(source)) {
      return;
    }

    try {
      renameSync(source, target);
      return;
    } catch {
      copyFileSync(source, target);
      unlinkSync(source);
    }
  }

  // ─── Preferences ────────────────────────────────────────────────

  getPreference(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM preferences WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  setPreference(key: string, value: string | null): void {
    if (value === null || value === undefined) {
      this.db.prepare('DELETE FROM preferences WHERE key = ?').run(key);
    } else {
      this.db.prepare('INSERT OR REPLACE INTO preferences (key, value) VALUES (?, ?)').run(key, value);
    }
  }

  getAllPreferences(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM preferences').all() as { key: string; value: string }[];
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  // ─── Non-ADO settings helpers ───────────────────────────────────

  saveNonAdoSettings(settings: AppSettings): void {
    this.db.transaction(() => {
      this.setPreference('maxConcurrentReviews', String(settings.reviewQueue.maxConcurrentReviews ?? 1));
      this.setPreference('defaultModel', normalizeDefaultModelId(settings.defaultModel));
      this.setPreference('defaultDiffViewMode', settings.defaultDiffViewMode ?? 'inline');
      this.setPreference('reviewStorageFolderPath', settings.reviewStorage?.folderPath ?? null);
      this.setPreference('myDisplayName', settings.myDisplayName ?? null);
      this.setPreference('skillsSourcePath', settings.skillsSourcePath?.trim() || null);
    })();
  }

  loadNonAdoSettings(): Partial<AppSettings> {
    const prefs = this.getAllPreferences();
    return {
      reviewQueue: {
        maxConcurrentReviews: Number(prefs.maxConcurrentReviews) || 1
      },
      reviewStorage: {
        folderPath: prefs.reviewStorageFolderPath || null
      },
      defaultModel: normalizeDefaultModelId(prefs.defaultModel),
      defaultDiffViewMode: (prefs.defaultDiffViewMode as 'inline' | 'side') || 'inline',
      myDisplayName: prefs.myDisplayName || null,
      skillsSourcePath: prefs.skillsSourcePath || undefined
    };
  }

  // ─── Prompt library ─────────────────────────────────────────────

  getPromptLibrary(): PromptLibrarySettings {
    const templates = this.db.prepare('SELECT * FROM prompt_templates ORDER BY created_at ASC').all() as Array<{
      id: string; name: string; category: string; content: string; created_at: string; updated_at: string;
    }>;

    const prompts: PromptTemplate[] = templates.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category as PromptCategory,
      content: row.content,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    const defaultPromptId = this.getPromptSetting('defaultPromptId') ?? prompts[0]?.id ?? 'default';
    const byCategory = this.getPromptSetting('defaultPromptIdByCategory');
    let defaultPromptIdByCategory: Partial<Record<PromptCategory, string>> = {};
    if (byCategory) {
      try { defaultPromptIdByCategory = JSON.parse(byCategory); } catch { /* ignore */ }
    }

    return { defaultPromptId, defaultPromptIdByCategory, prompts };
  }

  savePromptLibrary(settings: PromptLibrarySettings): void {
    this.db.transaction(() => {
      this.setPromptSetting('defaultPromptId', settings.defaultPromptId ?? null);
      this.setPromptSetting('defaultPromptIdByCategory',
        settings.defaultPromptIdByCategory ? JSON.stringify(settings.defaultPromptIdByCategory) : null);

      // Get existing ids
      const existingIds = new Set(
        (this.db.prepare('SELECT id FROM prompt_templates').all() as { id: string }[]).map((r) => r.id)
      );

      const now = new Date().toISOString();
      const incomingIds = new Set<string>();

      for (const prompt of settings.prompts) {
        incomingIds.add(prompt.id);
        if (existingIds.has(prompt.id)) {
          this.db.prepare(
            'UPDATE prompt_templates SET name = ?, category = ?, content = ?, updated_at = ? WHERE id = ?'
          ).run(prompt.name, prompt.category ?? 'PR Review', prompt.content, now, prompt.id);
        } else {
          this.db.prepare(
            'INSERT INTO prompt_templates (id, name, category, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(prompt.id, prompt.name, prompt.category ?? 'PR Review', prompt.content, now, now);
        }
      }

      // Delete removed prompts
      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) {
          this.db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(existingId);
        }
      }
    })();
  }

  private getPromptSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM prompt_settings WHERE key = ?').get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setPromptSetting(key: string, value: string | null): void {
    if (value === null || value === undefined) {
      this.db.prepare('DELETE FROM prompt_settings WHERE key = ?').run(key);
    } else {
      this.db.prepare('INSERT OR REPLACE INTO prompt_settings (key, value) VALUES (?, ?)').run(key, value);
    }
  }

  // ─── Review jobs ────────────────────────────────────────────────

  getAllReviewJobs(): ReviewJob[] {
    const rows = this.db.prepare(
      'SELECT * FROM review_jobs ORDER BY COALESCE(completed_at, queued_at) DESC'
    ).all() as ReviewJobRow[];
    return rows.map(rowToReviewJob);
  }

  getReviewJobsForPr(prId: number, prRepo: string): ReviewJob[] {
    const rows = this.db.prepare(
      'SELECT * FROM review_jobs WHERE pr_id = ? AND pr_repo = ? ORDER BY COALESCE(completed_at, queued_at) DESC'
    ).all(prId, prRepo) as ReviewJobRow[];
    return rows.map(rowToReviewJob);
  }

  getReviewJob(id: string): ReviewJob | null {
    const row = this.db.prepare('SELECT * FROM review_jobs WHERE id = ?').get(id) as ReviewJobRow | undefined;
    return row ? rowToReviewJob(row) : null;
  }

  upsertReviewJob(job: ReviewJob): void {
    const now = new Date().toISOString();
    const prJson = JSON.stringify(job.pullRequest);
    const reviewSessionOptionsJson = job.reviewSessionOptions
      ? JSON.stringify(job.reviewSessionOptions)
      : null;
    const skillMarkerResultsJson = job.skillMarkerResults && job.skillMarkerResults.length > 0
      ? JSON.stringify(job.skillMarkerResults)
      : null;
    const parsedReviewResultJson = (() => {
      const parsed = job.persistedResult ?? parseReviewResponse(job.reviewResponse);
      return parsed ? JSON.stringify(parsed) : null;
    })();
    const keepRawResponse = job.taskType === 'Changes summary' || !parsedReviewResultJson;
    this.db.prepare(`
      INSERT INTO review_jobs (id, pr_id, pr_repo, pr_json, task_type, prompt, model_name, status,
        progress_percent, review_response, error_message, queued_at, started_at, completed_at,
        hidden_in_queue, review_history, last_sent_prompt, is_re_review, session_key, skill_marker_results,
        review_session_options, effective_context_mode, fallback_reason, attempt_usage_summary, parsed_review_result, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        pr_json = excluded.pr_json,
        task_type = excluded.task_type,
        prompt = excluded.prompt,
        model_name = excluded.model_name,
        status = excluded.status,
        progress_percent = excluded.progress_percent,
        review_response = excluded.review_response,
        error_message = excluded.error_message,
        queued_at = excluded.queued_at,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        hidden_in_queue = excluded.hidden_in_queue,
        review_history = excluded.review_history,
        last_sent_prompt = excluded.last_sent_prompt,
        is_re_review = excluded.is_re_review,
        session_key = excluded.session_key,
        skill_marker_results = excluded.skill_marker_results,
        review_session_options = excluded.review_session_options,
        effective_context_mode = excluded.effective_context_mode,
        fallback_reason = excluded.fallback_reason,
        attempt_usage_summary = excluded.attempt_usage_summary,
        parsed_review_result = excluded.parsed_review_result,
        updated_at = excluded.updated_at
    `).run(
      job.id,
      job.pullRequest.id,
      job.pullRequest.repository,
      prJson,
      job.taskType ?? null,
      job.prompt,
      job.modelName ?? null,
      job.status,
      job.progressPercent,
      keepRawResponse ? job.reviewResponse ?? null : null,
      job.errorMessage ?? null,
      job.queuedAt,
      job.startedAt ?? null,
      job.completedAt ?? null,
      job.hiddenInQueue ? 1 : 0,
      job.reviewHistory ? JSON.stringify(job.reviewHistory) : null,
      job.lastSentPrompt ?? null,
      job.isReReview ? 1 : 0,
      job.sessionKey ?? null,
      skillMarkerResultsJson,
      reviewSessionOptionsJson,
      job.effectiveContextMode ?? null,
      job.fallbackReason ?? null,
      job.attemptUsageSummary ? JSON.stringify(job.attemptUsageSummary) : null,
      parsedReviewResultJson,
      job.createdAt ?? job.queuedAt ?? now,
      now
    );
  }

  deleteReviewJob(id: string): void {
    this.db.prepare('DELETE FROM review_jobs WHERE id = ?').run(id);
  }

  deleteReviewJobsForPr(prId: number, prRepo: string): void {
    this.db.prepare('DELETE FROM review_jobs WHERE pr_id = ? AND pr_repo = ?').run(prId, prRepo);
  }

  deleteAllReviewJobs(): void {
    this.db.prepare('DELETE FROM review_jobs').run();
  }

  /** Delete review jobs older than the given date. Returns the number of deleted rows. */
  purgeReviewJobsOlderThan(date: Date): number {
    const iso = date.toISOString();
    const result = this.db.prepare('DELETE FROM review_jobs WHERE created_at < ?').run(iso);
    return result.changes;
  }

  // ─── Follow-up contexts ─────────────────────────────────────────

  getFollowUpContexts(prId: number, prRepo: string): FollowUpContext[] {
    const rows = this.db.prepare(
      'SELECT * FROM follow_up_contexts WHERE pr_id = ? AND pr_repo = ? ORDER BY created_at DESC'
    ).all(prId, prRepo) as FollowUpRow[];
    return rows.map((row) => this.hydrateFollowUp(row));
  }

  getFollowUpContext(contextId: string): FollowUpContext | null {
    const row = this.db.prepare(
      'SELECT * FROM follow_up_contexts WHERE id = ?'
    ).get(contextId) as FollowUpRow | undefined;
    return row ? this.hydrateFollowUp(row) : null;
  }

  getFollowUpContextSummaries(prId: number, prRepo: string): FollowUpContextSummary[] {
    const rows = this.db.prepare(
      'SELECT * FROM follow_up_contexts WHERE pr_id = ? AND pr_repo = ? ORDER BY created_at DESC'
    ).all(prId, prRepo) as FollowUpRow[];

    // Return only the latest context per review_job_id
    const latestByJob = new Map<string, FollowUpContextSummary>();
    for (const row of rows) {
      const jobId = row.review_job_id ?? '';
      if (!latestByJob.has(jobId)) {
        latestByJob.set(jobId, {
          id: row.id,
          name: row.name,
          pullRequestId: row.pr_id,
          reviewJobId: row.review_job_id ?? '',
          modelName: row.model_name,
          messageCount: row.message_count,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        });
      }
    }
    return Array.from(latestByJob.values());
  }

  saveFollowUpContext(context: FollowUpContext): void {
    const now = new Date().toISOString();
    const prJson = JSON.stringify(context.pullRequest);
    const reviewSessionOptionsJson = context.reviewSessionOptions
      ? JSON.stringify(context.reviewSessionOptions)
      : null;
    const messageCount = context.messages.length > 0
      ? context.messages.length
      : (context.persistedMessageCount ?? 0);
    this.db.prepare(`
      INSERT INTO follow_up_contexts (id, pr_id, pr_repo, pr_json, review_job_id, name, model_name,
        initial_prompt, initial_response, message_count, is_streaming, review_session_options,
        effective_context_mode, fallback_reason, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        model_name = excluded.model_name,
        initial_prompt = excluded.initial_prompt,
        initial_response = excluded.initial_response,
        message_count = excluded.message_count,
        is_streaming = excluded.is_streaming,
        review_session_options = excluded.review_session_options,
        effective_context_mode = excluded.effective_context_mode,
        fallback_reason = excluded.fallback_reason,
        updated_at = excluded.updated_at
    `).run(
      context.id,
      context.pullRequest.id,
      context.pullRequest.repository,
      prJson,
      context.reviewJobId,
      context.name,
      normalizeSelectableModelId(context.modelName),
      context.initialPrompt,
      context.initialResponse,
      messageCount,
      context.isStreaming ? 1 : 0,
      reviewSessionOptionsJson,
      context.effectiveContextMode ?? null,
      context.fallbackReason ?? null,
      context.createdAt ?? now,
      now
    );
  }

  deleteFollowUpContext(contextId: string): void {
    // Messages deleted by ON DELETE CASCADE
    this.db.prepare('DELETE FROM follow_up_contexts WHERE id = ?').run(contextId);
  }

  getFollowUpContextIdsForReviewJob(reviewJobId: string): string[] {
    return (this.db.prepare(
      'SELECT id FROM follow_up_contexts WHERE review_job_id = ? ORDER BY created_at DESC'
    ).all(reviewJobId) as Array<{ id: string }>).map((row) => row.id);
  }

  deleteFollowUpsForReviewJob(reviewJobId: string): void {
    this.db.prepare('DELETE FROM follow_up_contexts WHERE review_job_id = ?').run(reviewJobId);
  }

  deleteFollowUpsForPr(prId: number, prRepo: string): void {
    // Get context ids first – messages cascade
    this.db.prepare('DELETE FROM follow_up_contexts WHERE pr_id = ? AND pr_repo = ?').run(prId, prRepo);
  }

  deleteAllFollowUps(): void {
    this.db.prepare('DELETE FROM follow_up_contexts').run();
  }

  getFollowUpContextIdsOlderThan(date: Date): string[] {
    const iso = date.toISOString();
    return (this.db.prepare(
      'SELECT id FROM follow_up_contexts WHERE created_at < ? ORDER BY created_at DESC'
    ).all(iso) as Array<{ id: string }>).map((row) => row.id);
  }

  /** Delete follow-up contexts older than the given date. Returns the number of deleted rows. */
  purgeFollowUpsOlderThan(date: Date): number {
    const iso = date.toISOString();
    const result = this.db.prepare('DELETE FROM follow_up_contexts WHERE created_at < ?').run(iso);
    return result.changes;
  }

  // ─── Work items summary instructions ────────────────────────────

  getWorkItemsSummaryInstructions(): string {
    return this.getPreference('workItemsSummaryInstructions') ?? '';
  }

  setWorkItemsSummaryInstructions(value: string): void {
    this.setPreference('workItemsSummaryInstructions', value);
  }

  // ─── Purge all data older than N days ───────────────────────────

  purgeOlderThan(days: number): { reviewJobs: number; followUps: number } {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const reviewJobs = this.purgeReviewJobsOlderThan(cutoff);
    const followUps = this.purgeFollowUpsOlderThan(cutoff);
    return { reviewJobs, followUps };
  }

  // ─── Copilot sessions ───────────────────────────────────────────

  getCopilotSession(contextKey: string): CopilotSessionMapping | null {
    const row = this.db.prepare(
      'SELECT * FROM copilot_sessions WHERE context_key = ?'
    ).get(contextKey) as CopilotSessionRow | undefined;
    return row ? rowToCopilotSessionMapping(row) : null;
  }

  getCopilotSessionsForPr(prId: number, prRepo: string): CopilotSessionMapping[] {
    const rows = this.db.prepare(
      'SELECT * FROM copilot_sessions WHERE pr_id = ? AND pr_repo = ?'
    ).all(prId, prRepo) as CopilotSessionRow[];
    return rows.map(rowToCopilotSessionMapping);
  }

  getAllCopilotSessions(): CopilotSessionMapping[] {
    const rows = this.db.prepare('SELECT * FROM copilot_sessions').all() as CopilotSessionRow[];
    return rows.map(rowToCopilotSessionMapping);
  }

  getPurgeableReviewSessionKeys(date: Date): string[] {
    const cutoffIso = date.toISOString();
    return this.getAllCopilotSessions()
      .filter((mapping) => mapping.scope === 'review')
      .filter((mapping) => mapping.lastUsed < cutoffIso)
      .filter((mapping) => !this.hasRemainingReviewJobForSession(mapping))
      .map((mapping) => mapping.contextKey);
  }

  upsertCopilotSession(mapping: CopilotSessionMapping): void {
    this.db.prepare(`
      INSERT INTO copilot_sessions (context_key, session_id, scope, pr_id, pr_repo, model_name, created_at, last_used)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(context_key) DO UPDATE SET
        session_id = excluded.session_id,
        scope = excluded.scope,
        pr_id = excluded.pr_id,
        pr_repo = excluded.pr_repo,
        model_name = excluded.model_name,
        last_used = excluded.last_used
    `).run(
      mapping.contextKey,
      mapping.sessionId,
      mapping.scope,
      mapping.prId ?? null,
      mapping.prRepo ?? null,
      mapping.modelName ? normalizeSelectableModelId(mapping.modelName) : null,
      mapping.createdAt,
      mapping.lastUsed
    );
  }

  touchCopilotSession(contextKey: string): void {
    this.db.prepare(
      'UPDATE copilot_sessions SET last_used = ? WHERE context_key = ?'
    ).run(new Date().toISOString(), contextKey);
  }

  deleteCopilotSession(contextKey: string): void {
    this.db.prepare('DELETE FROM copilot_sessions WHERE context_key = ?').run(contextKey);
  }

  deleteCopilotSessionsForPr(prId: number, prRepo: string): void {
    this.db.prepare('DELETE FROM copilot_sessions WHERE pr_id = ? AND pr_repo = ?').run(prId, prRepo);
  }

  deleteAllCopilotSessions(): void {
    this.db.prepare('DELETE FROM copilot_sessions').run();
  }

  private hasRemainingReviewJobForSession(mapping: CopilotSessionMapping): boolean {
    if (mapping.prId == null || !mapping.prRepo) {
      return false;
    }

    const row = this.db.prepare(`
      SELECT 1
      FROM review_jobs
      WHERE pr_id = ?
        AND pr_repo = ?
        AND COALESCE(model_name, 'Auto') = COALESCE(?, 'Auto')
      LIMIT 1
    `).get(mapping.prId, mapping.prRepo, mapping.modelName ? normalizeSelectableModelId(mapping.modelName) : null) as { 1: number } | undefined;

    return Boolean(row);
  }

  // ─── Skills ─────────────────────────────────────────────────────

  getSkills(scope?: SkillScope, projectKey?: string): SkillInfo[] {
    let sql = 'SELECT * FROM skills';
    const params: unknown[] = [];
    const conditions: string[] = [];
    if (scope) {
      conditions.push('scope = ?');
      params.push(scope);
    }
    if (projectKey) {
      conditions.push('project_key = ?');
      params.push(projectKey);
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ' ORDER BY scope ASC, name ASC';
    const rows = this.db.prepare(sql).all(...params) as SkillRow[];
    return rows.map(rowToSkill);
  }

  upsertSkill(skill: SkillInfo, content?: string | null, contentHash?: string | null): void {
    const now = new Date().toISOString();
    const linkedOrgIds = skill.linkedOrganizationIds && skill.linkedOrganizationIds.length > 0
      ? JSON.stringify(skill.linkedOrganizationIds)
      : null;
    this.db.prepare(`
      INSERT INTO skills (
        id, name, description, scope, project_key, linked_organization_ids,
        folder_path, is_active, is_hidden, marker,
        content, content_hash, disk_hash, is_mismatched, mismatch_reason, last_validation_at,
        last_synced_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        scope = excluded.scope,
        project_key = excluded.project_key,
        linked_organization_ids = excluded.linked_organization_ids,
        folder_path = excluded.folder_path,
        is_active = excluded.is_active,
        is_hidden = excluded.is_hidden,
        marker = excluded.marker,
        content = excluded.content,
        content_hash = excluded.content_hash,
        disk_hash = excluded.disk_hash,
        is_mismatched = excluded.is_mismatched,
        mismatch_reason = excluded.mismatch_reason,
        last_validation_at = excluded.last_validation_at,
        last_synced_at = excluded.last_synced_at,
        updated_at = excluded.updated_at
    `).run(
      skill.id,
      skill.name,
      skill.description,
      skill.scope,
      skill.projectKey ?? null,
      linkedOrgIds,
      skill.folderPath,
      skill.isActive ? 1 : 0,
      skill.isHidden ? 1 : 0,
      skill.marker,
      content ?? null,
      contentHash ?? skill.contentHash ?? null,
      skill.diskHash ?? null,
      skill.isMismatched ? 1 : 0,
      skill.mismatchReason ?? null,
      skill.lastValidationAt ?? null,
      skill.lastSyncedAt ?? null,
      skill.createdAt ?? now,
      now
    );
  }

  getSkillContent(id: string): string | null {
    const row = this.db.prepare('SELECT content FROM skills WHERE id = ?').get(id) as { content: string | null } | undefined;
    return row?.content ?? null;
  }

  getSkillContentHash(id: string): string | null {
    const row = this.db.prepare('SELECT content_hash FROM skills WHERE id = ?').get(id) as { content_hash: string | null } | undefined;
    return row?.content_hash ?? null;
  }

  updateSkillCanonicalContent(id: string, content: string, contentHash: string): void {
    this.db.prepare(
      'UPDATE skills SET content = ?, content_hash = ?, updated_at = ? WHERE id = ?'
    ).run(content, contentHash, new Date().toISOString(), id);
  }

  updateSkillIntegrity(
    id: string,
    isMismatched: boolean,
    mismatchReason: SkillMismatchReason | null,
    diskHash: string | null,
    validatedAt: string
  ): void {
    this.db.prepare(
      'UPDATE skills SET is_mismatched = ?, mismatch_reason = ?, disk_hash = ?, last_validation_at = ?, updated_at = ? WHERE id = ?'
    ).run(
      isMismatched ? 1 : 0,
      mismatchReason,
      diskHash,
      validatedAt,
      new Date().toISOString(),
      id
    );
  }

  getMismatchedSkills(): SkillInfo[] {
    const rows = this.db.prepare('SELECT * FROM skills WHERE is_mismatched = 1 ORDER BY scope ASC, name ASC').all() as SkillRow[];
    return rows.map(rowToSkill);
  }

  getSkillsIntegritySummary(): SkillIntegritySummary {
    const summaryRow = this.db.prepare(`
      SELECT
        COUNT(*) AS total_skills,
        SUM(CASE WHEN is_mismatched = 1 THEN 1 ELSE 0 END) AS mismatch_count,
        MAX(last_validation_at) AS last_validated_at
      FROM skills
    `).get() as {
      total_skills: number;
      mismatch_count: number | null;
      last_validated_at: string | null;
    };

    const mismatchRows = this.db.prepare(`
      SELECT id, name, scope, project_key, folder_path, mismatch_reason
      FROM skills
      WHERE is_mismatched = 1
      ORDER BY scope ASC, name ASC
    `).all() as Array<{
      id: string;
      name: string;
      scope: string;
      project_key: string | null;
      folder_path: string;
      mismatch_reason: SkillMismatchReason;
    }>;

    const mismatches: SkillMismatchInfo[] = mismatchRows.map((row) => ({
      skillId: row.id,
      skillName: row.name,
      scope: row.scope as SkillScope,
      projectKey: row.project_key,
      reason: (row.mismatch_reason ?? 'content_differs') as SkillMismatchReason,
      folderPath: row.folder_path
    }));

    return {
      totalSkills: summaryRow.total_skills ?? 0,
      mismatchCount: summaryRow.mismatch_count ?? 0,
      lastValidatedAt: summaryRow.last_validated_at,
      mismatches
    };
  }

  deleteSkill(id: string): void {
    this.db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  }

  deleteSkillsByProjectKey(projectKey: string): void {
    this.db.prepare('DELETE FROM skills WHERE project_key = ?').run(projectKey);
  }

  toggleSkillHidden(id: string, isHidden: boolean): void {
    this.db.prepare('UPDATE skills SET is_hidden = ?, updated_at = ? WHERE id = ?')
      .run(isHidden ? 1 : 0, new Date().toISOString(), id);
  }

  updateSkillLinkedOrganizations(id: string, linkedOrganizationIds: string[] | null): void {
    const value = linkedOrganizationIds && linkedOrganizationIds.length > 0
      ? JSON.stringify(linkedOrganizationIds)
      : null;
    this.db.prepare('UPDATE skills SET linked_organization_ids = ?, updated_at = ? WHERE id = ?')
      .run(value, new Date().toISOString(), id);
  }

  getSkillProjectKeys(): string[] {
    const rows = this.db.prepare(
      "SELECT DISTINCT project_key FROM skills WHERE scope = 'project' AND project_key IS NOT NULL ORDER BY project_key ASC"
    ).all() as Array<{ project_key: string }>;
    return rows.map((r) => r.project_key);
  }

  // ─── Azure DevOps metadata (DB-backed, PAT excluded) ─────────

  getAdoOrganizations(): AdoOrganizationMetadata[] {
    const rows = this.db.prepare('SELECT id, name FROM ado_organizations ORDER BY name ASC').all() as AdoOrganizationRow[];
    return rows.map((row) => ({ id: row.id, name: row.name }));
  }

  saveAdoOrganizations(orgs: AdoOrganizationMetadata[]): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const existingIds = new Set(
        (this.db.prepare('SELECT id FROM ado_organizations').all() as Array<{ id: string }>).map((r) => r.id)
      );
      const incomingIds = new Set<string>();

      for (const org of orgs) {
        incomingIds.add(org.id);
        this.db.prepare(`
          INSERT INTO ado_organizations (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            updated_at = excluded.updated_at
        `).run(org.id, org.name, now, now);
      }

      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) {
          this.db.prepare('DELETE FROM ado_organizations WHERE id = ?').run(existingId);
        }
      }
    })();
  }

  getPrSources(): PrSource[] {
    const rows = this.db.prepare(
      'SELECT id, name, organization_id, project, repository FROM ado_pr_sources ORDER BY name ASC'
    ).all() as AdoPrSourceRow[];
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      organizationId: row.organization_id,
      project: row.project,
      repository: row.repository
    }));
  }

  savePrSources(sources: PrSource[]): void {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      const existingIds = new Set(
        (this.db.prepare('SELECT id FROM ado_pr_sources').all() as Array<{ id: string }>).map((r) => r.id)
      );
      const incomingIds = new Set<string>();

      for (const source of sources) {
        incomingIds.add(source.id);
        this.db.prepare(`
          INSERT INTO ado_pr_sources (id, name, organization_id, project, repository, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            organization_id = excluded.organization_id,
            project = excluded.project,
            repository = excluded.repository,
            updated_at = excluded.updated_at
        `).run(
          source.id,
          source.name,
          source.organizationId,
          source.project,
          source.repository ?? null,
          now,
          now
        );
      }

      for (const existingId of existingIds) {
        if (!incomingIds.has(existingId)) {
          this.db.prepare('DELETE FROM ado_pr_sources WHERE id = ?').run(existingId);
        }
      }
    })();
  }

  // ─── Migration check ───────────────────────────────────────────

  isMigrated(): boolean {
    return this.getPreference('migratedFromFiles') === 'true';
  }

  setMigrated(): void {
    this.setPreference('migratedFromFiles', 'true');
  }

  // ─── Private helpers ────────────────────────────────────────────

  private hydrateFollowUp(row: FollowUpRow): FollowUpContext {
    let pullRequest: PullRequestSummary;
    try { pullRequest = JSON.parse(row.pr_json); } catch { pullRequest = { id: row.pr_id, repository: row.pr_repo } as PullRequestSummary; }

    return {
      id: row.id,
      name: row.name,
      pullRequest,
      reviewJobId: row.review_job_id ?? '',
      initialPrompt: row.initial_prompt,
      initialResponse: row.initial_response,
      modelName: normalizeSelectableModelId(row.model_name),
      messages: [],
      isStreaming: false,
      persistedMessageCount: row.message_count,
      reviewSessionOptions: row.review_session_options
        ? safeParseJson<ReviewSessionOptions | null>(row.review_session_options, null)
        : null,
      effectiveContextMode: row.effective_context_mode as FollowUpContext['effectiveContextMode'],
      fallbackReason: row.fallback_reason,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

// ─── Row types ──────────────────────────────────────────────────

interface ReviewJobRow {
  id: string;
  pr_id: number;
  pr_repo: string;
  pr_json: string;
  task_type: string | null;
  prompt: string;
  model_name: string | null;
  status: string;
  progress_percent: number;
  review_response: string | null;
  error_message: string | null;
  queued_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  hidden_in_queue: number;
  review_history: string | null;
  last_sent_prompt: string | null;
  is_re_review: number;
  session_key: string | null;
  skill_marker_results: string | null;
  review_session_options: string | null;
  effective_context_mode: string | null;
  fallback_reason: string | null;
  attempt_usage_summary: string | null;
  parsed_review_result: string | null;
  created_at: string;
  updated_at: string;
}

interface FollowUpRow {
  id: string;
  pr_id: number;
  pr_repo: string;
  pr_json: string;
  review_job_id: string | null;
  name: string;
  model_name: string;
  initial_prompt: string;
  initial_response: string;
  message_count: number;
  is_streaming: number;
  review_session_options: string | null;
  effective_context_mode: string | null;
  fallback_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface CopilotSessionRow {
  context_key: string;
  session_id: string;
  scope: string;
  pr_id: number | null;
  pr_repo: string | null;
  model_name: string | null;
  created_at: string;
  last_used: string;
}

export interface CopilotSessionMapping {
  contextKey: string;
  sessionId: string;
  scope: string;
  prId: number | null;
  prRepo: string | null;
  modelName: string | null;
  createdAt: string;
  lastUsed: string;
}

function rowToCopilotSessionMapping(row: CopilotSessionRow): CopilotSessionMapping {
  return {
    contextKey: row.context_key,
    sessionId: row.session_id,
    scope: row.scope,
    prId: row.pr_id,
    prRepo: row.pr_repo,
    modelName: row.model_name ? normalizeSelectableModelId(row.model_name) : null,
    createdAt: row.created_at,
    lastUsed: row.last_used
  };
}

// ─── Row → model converters ─────────────────────────────────────

function safeParseJson<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function rowToReviewJob(row: ReviewJobRow): ReviewJob {
  let pullRequest: PullRequestSummary;
  try { pullRequest = JSON.parse(row.pr_json); } catch { pullRequest = { id: row.pr_id, repository: row.pr_repo } as PullRequestSummary; }

  return {
    id: row.id,
    pullRequest,
    taskType: (row.task_type as ReviewJob['taskType']) ?? undefined,
    prompt: row.prompt,
    modelName: row.model_name ? normalizeSelectableModelId(row.model_name) : null,
    status: row.status as ReviewJob['status'],
    progressPercent: row.progress_percent,
    reviewResponse: row.review_response,
    errorMessage: row.error_message,
    queuedAt: row.queued_at ?? row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    hiddenInQueue: row.hidden_in_queue === 1,
    reviewHistory: row.review_history ? safeParseJson(row.review_history, []) : undefined,
    lastSentPrompt: row.last_sent_prompt,
    isReReview: row.is_re_review === 1,
    sessionKey: row.session_key,
    skillMarkerResults: row.skill_marker_results ? safeParseJson(row.skill_marker_results, []) : undefined,
    reviewSessionOptions: row.review_session_options
      ? safeParseJson<ReviewSessionOptions | null>(row.review_session_options, null)
      : null,
    effectiveContextMode: row.effective_context_mode as ReviewJob['effectiveContextMode'],
    fallbackReason: row.fallback_reason,
    attemptUsageSummary: row.attempt_usage_summary ? safeParseJson(row.attempt_usage_summary, undefined) : undefined,
    persistedResult: row.parsed_review_result ? safeParseJson<CopilotReviewResult | null>(row.parsed_review_result, null) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

// ─── Skill row type & converter ──────────────────────────────────

interface SkillRow {
  id: string;
  name: string;
  description: string;
  scope: string;
  project_key: string | null;
  linked_organization_ids: string | null;
  folder_path: string;
  is_active: number;
  is_hidden: number;
  marker: string;
  content: string | null;
  content_hash: string | null;
  disk_hash: string | null;
  is_mismatched: number;
  mismatch_reason: SkillMismatchReason | null;
  last_validation_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface AdoOrganizationRow {
  id: string;
  name: string;
}

interface AdoPrSourceRow {
  id: string;
  name: string;
  organization_id: string;
  project: string;
  repository: string | null;
}

function rowToSkill(row: SkillRow): SkillInfo {
  let linkedOrganizationIds: string[] | null = null;
  if (row.linked_organization_ids) {
    try { linkedOrganizationIds = JSON.parse(row.linked_organization_ids); } catch { /* ignore */ }
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    scope: row.scope as SkillScope,
    projectKey: row.project_key,
    linkedOrganizationIds,
    folderPath: row.folder_path,
    isActive: row.is_active === 1,
    isHidden: row.is_hidden === 1,
    marker: row.marker,
    contentHash: row.content_hash,
    diskHash: row.disk_hash,
    isMismatched: row.is_mismatched === 1,
    mismatchReason: row.mismatch_reason,
    lastValidationAt: row.last_validation_at,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
