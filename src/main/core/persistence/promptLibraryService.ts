import { PromptCategory, PromptLibrarySettings, PromptTemplate } from '@shared/types/models';
import { DatabaseService } from '@main/core/persistence/databaseService';

export class PromptLibraryService {
  constructor(private readonly database: DatabaseService) {}

  async load(): Promise<PromptLibrarySettings> {
    return this.database.getPromptLibrary();
  }

  async saveSettings(settings: PromptLibrarySettings): Promise<PromptLibrarySettings> {
    this.database.savePromptLibrary(settings);
    return this.database.getPromptLibrary();
  }

  async addPrompt(category: PromptCategory = 'PR Review'): Promise<PromptLibrarySettings> {
    const settings = this.database.getPromptLibrary();
    const prompt: PromptTemplate = {
      id: `prompt-${Date.now()}`,
      name: `New prompt ${settings.prompts.length + 1}`,
      category,
      content: ''
    };
    const updated: PromptLibrarySettings = {
      ...settings,
      prompts: [...settings.prompts, prompt]
    };
    this.database.savePromptLibrary(updated);
    return this.database.getPromptLibrary();
  }

  async removePrompt(id: string): Promise<PromptLibrarySettings> {
    const settings = this.database.getPromptLibrary();
    const removed = settings.prompts.find((p) => p.id === id);
    const prompts = settings.prompts.filter((p) => p.id !== id);
    if (prompts.length === 0) {
      return settings;
    }

    const nextByCategory = {
      ...(settings.defaultPromptIdByCategory ?? {})
    } as Partial<Record<PromptCategory, string>>;

    if (removed?.category && nextByCategory[removed.category] === id) {
      nextByCategory[removed.category] = prompts.find((p) => p.category === removed.category)?.id;
    }

    const defaultPromptId = settings.defaultPromptId === id
      ? (nextByCategory['PR Review'] ?? prompts[0].id)
      : settings.defaultPromptId;

    const updated: PromptLibrarySettings = {
      ...settings,
      prompts,
      defaultPromptId,
      defaultPromptIdByCategory: nextByCategory
    };
    this.database.savePromptLibrary(updated);
    return this.database.getPromptLibrary();
  }
}
