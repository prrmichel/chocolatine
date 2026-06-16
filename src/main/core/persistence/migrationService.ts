import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { basename, join } from 'path';
import {
  AppSettings,
  FollowUpContext,
  PromptLibrarySettings,
  PullRequestSummary,
  ReviewJob
} from '@shared/types/models';
import { DatabaseService } from '@main/core/persistence/databaseService';
import { SettingsStore } from '@main/core/persistence/settingsStore';

/**
 * One-time migration: reads existing JSON files from the old file-based storage
 * and imports them into the SQLite database.
 * Safe to call on every launch — skips if already migrated.
 */
export function migrateFilesToDatabase(settingsStore: SettingsStore, db: DatabaseService): void {
  if (db.isMigrated()) {
    return;
  }

  try {
    // 1. Migrate settings (non-ADO portions)
    const legacySettings = settingsStore.readLegacySettingsFile();
    if (legacySettings) {
      migrateSettings(db, legacySettings);
      migratePromptLibrary(db, legacySettings);
    }

    // 2. Migrate review jobs + follow-ups from the storage folder
    const folderPath = legacySettings?.reviewStorage?.folderPath?.trim();
    if (folderPath) {
      migrateStorageFolder(db, legacySettings!, folderPath);
    }

    db.setMigrated();
  } catch (error) {
    console.error('[migration] Migration failed (non-fatal):', error);
    // Set migrated anyway to avoid retrying a broken migration every launch
    db.setMigrated();
  }
}

function migrateSettings(db: DatabaseService, settings: AppSettings): void {
  db.saveNonAdoSettings(settings);

  // Work items summary instructions from file
  const folderPath = settings.reviewStorage?.folderPath?.trim();
  if (folderPath) {
    const instructionsPath = join(folderPath, 'work-items-summary-instructions.txt');
    if (existsSync(instructionsPath)) {
      try {
        const content = readFileSync(instructionsPath, 'utf-8');
        db.setWorkItemsSummaryInstructions(content);
      } catch {
        // Non-blocking
      }
    }
  }
}

function migratePromptLibrary(db: DatabaseService, settings: AppSettings): void {
  // Try folder-based prompt library first
  const folderPath = settings.reviewStorage?.folderPath?.trim();
  if (folderPath) {
    const promptLibraryPath = join(folderPath, 'prompt-library.json');
    if (existsSync(promptLibraryPath)) {
      try {
        const raw = readFileSync(promptLibraryPath, 'utf-8');
        const library = JSON.parse(raw) as PromptLibrarySettings;
        if (library && Array.isArray(library.prompts) && library.prompts.length > 0) {
          db.savePromptLibrary(library);
          return;
        }
      } catch {
        // Fall through to settings.json version
      }
    }
  }

  // Fall back to settings.json prompt library
  if (settings.promptLibrary && settings.promptLibrary.prompts.length > 0) {
    db.savePromptLibrary(settings.promptLibrary);
  }
}

function migrateStorageFolder(db: DatabaseService, settings: AppSettings, folderPath: string): void {
  const appRoot = join(folderPath, 'epullrequest-reviews');
  if (!existsSync(appRoot)) {
    return;
  }

  // Synchronous walk to keep migration blocking (runs once at startup)
  const walkJson = (dir: string): string[] => {
    const results: string[] = [];
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return results; }

    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        const s = statSync(full);
        if (s.isDirectory()) {
          results.push(...walkJson(full));
        } else if (s.isFile() && entry.toLowerCase().endsWith('.json')) {
          results.push(full);
        }
      } catch {
        // Skip inaccessible entries
      }
    }
    return results;
  };

  const jsonFiles = walkJson(appRoot);

  for (const file of jsonFiles) {
    const name = basename(file).toLowerCase();

    if (/^pr-\d+-followups\.json$/.test(name)) {
      // Follow-up contexts
      try {
        const raw = readFileSync(file, 'utf-8');
        const contexts = JSON.parse(raw) as FollowUpContext[];
        if (Array.isArray(contexts)) {
          for (const ctx of contexts) {
            if (ctx && ctx.id && ctx.pullRequest) {
              ctx.isStreaming = false;
              db.saveFollowUpContext(ctx);
            }
          }
        }
      } catch {
        // Skip invalid files
      }
    } else if (/^pr-\d+\.json$/.test(name)) {
      // Review jobs
      try {
        const raw = readFileSync(file, 'utf-8');
        const jobs = JSON.parse(raw) as ReviewJob[];
        if (Array.isArray(jobs)) {
          for (const job of jobs) {
            if (isValidJob(job)) {
              db.upsertReviewJob(job);
            }
          }
        }
      } catch {
        // Skip invalid files
      }
    }
  }

}

function isValidJob(item: unknown): item is ReviewJob {
  if (!item || typeof item !== 'object') return false;
  const c = item as Partial<ReviewJob>;
  const pr = c.pullRequest as Partial<PullRequestSummary> | undefined;
  return (
    typeof c.id === 'string'
    && typeof c.prompt === 'string'
    && typeof c.status === 'string'
    && typeof c.queuedAt === 'string'
    && !!pr
    && typeof pr.id === 'number'
    && typeof pr.repository === 'string'
  );
}
