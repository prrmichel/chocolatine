import { create } from 'zustand';
import { api } from '@renderer/services/api';
import { AppSettings, ModelInfo, PromptCategory, PromptLibrarySettings, SettingsSaveResult } from '@shared/types/models';
import {
  AUTO_MODEL_ID,
  getFallbackFreeModelId,
  normalizeDefaultModelId,
  normalizeSelectableModelId,
  reconcileSelectableModelId,
  resetKnownModels,
  updateKnownModels,
  KnownModelDefinition
} from '@shared/constants/modelOptions';

type ModelCatalogStatus = 'idle' | 'loading' | 'ready' | 'failed';

interface SettingsState {
  settings: AppSettings | null;
  promptLibrary: PromptLibrarySettings | null;
  modelName: string;
  workItemsSummaryModelName: string;
  workItemsSummaryPromptExtra: string;
  workItemsSummaryPromptLoaded: boolean;
  modelFallbackNotice: string | null;
  modelCatalog: ModelInfo[];
  modelCatalogStatus: ModelCatalogStatus;
  /** Incremented each time the model list is refreshed — lets React memos invalidate. */
  modelsVersion: number;

  loadSettings: () => Promise<void>;
  loadPromptLibrary: () => Promise<void>;
  loadWorkItemsSummaryInstructions: () => Promise<void>;
  saveSettings: (updated: AppSettings) => Promise<SettingsSaveResult>;
  savePromptLibrary: (library: PromptLibrarySettings) => Promise<void>;
  addPrompt: (category?: PromptCategory) => Promise<void>;
  removePrompt: (id: string) => Promise<void>;
  setModelName: (name: string) => void;
  setWorkItemsSummaryModelName: (name: string) => void;
  setWorkItemsSummaryPromptExtra: (value: string) => void;
  persistWorkItemsSummaryInstructions: () => Promise<void>;
  /** Fetch models from the SDK and refresh KNOWN_MODELS + lookups. */
  loadDynamicModels: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  promptLibrary: null,
  modelName: getFallbackFreeModelId(),
  workItemsSummaryModelName: getFallbackFreeModelId(),
  workItemsSummaryPromptExtra: '',
  workItemsSummaryPromptLoaded: false,
  modelFallbackNotice: null,
  modelCatalog: [],
  modelCatalogStatus: 'idle',
  modelsVersion: 0,

  loadSettings: async () => {
    const loaded = await api.getSettings();
    set({ settings: loaded });
    const defaultModel = normalizeDefaultModelId(loaded.defaultModel);
    set({
      modelName: defaultModel,
      workItemsSummaryModelName: defaultModel
    });
  },

  loadPromptLibrary: async () => {
    const library = await api.getPromptLibrary();
    set({ promptLibrary: library });
  },

  loadWorkItemsSummaryInstructions: async () => {
    set({ workItemsSummaryPromptExtra: '', workItemsSummaryPromptLoaded: true });
  },

  saveSettings: async (updated: AppSettings) => {
    const result = await api.saveSettings({
      ...updated,
      defaultModel: normalizeDefaultModelId(updated.defaultModel)
    });
    const saved = result.settings;
    set({ settings: saved });
    const defaultModel = normalizeDefaultModelId(saved.defaultModel);
    set({
      modelName: defaultModel,
      workItemsSummaryModelName: defaultModel
    });
    return result;
  },

  savePromptLibrary: async (library: PromptLibrarySettings) => {
    const saved = await api.savePromptLibrary(library);
    set({ promptLibrary: saved });
  },

  addPrompt: async (category = 'PR Review') => {
    const saved = await api.addPrompt(category);
    set({ promptLibrary: saved });
  },

  removePrompt: async (id: string) => {
    const saved = await api.removePrompt(id);
    set({ promptLibrary: saved });
  },

  setModelName: (name: string) => set({ modelName: normalizeSelectableModelId(name) }),
  setWorkItemsSummaryModelName: (name: string) => set({ workItemsSummaryModelName: normalizeSelectableModelId(name) }),
  setWorkItemsSummaryPromptExtra: (value: string) => set({ workItemsSummaryPromptExtra: value }),

  persistWorkItemsSummaryInstructions: async () => {
    return;
  },

  loadDynamicModels: async () => {
    set({
      modelCatalogStatus: 'loading',
      modelFallbackNotice: null
    });

    // Remove legacy cached model catalog so SDK is the single source of truth.
    try {
      await api.setUIPref('cachedModelList', null);
    } catch (err) {
      console.warn('[models] Failed to clear legacy cached model list from SQLite:', err);
    }

    // Fetch from SDK with retry (5 attempts, 5s apart = up to ~25s)
    let sdkModels: ModelInfo[] = [];
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const traceId = `models-startup-${Date.now()}-attempt-${attempt + 1}`;
        // Runtime chain: renderer api -> preload listCopilotModels -> IPC COPILOT_LIST_MODELS -> CopilotSessionManager.listModels -> SDK client.listModels
        sdkModels = await api.listCopilotModels(traceId);
        if (sdkModels && sdkModels.length > 0) {
          break;
        }
      } catch (err) {
        console.warn(`[models] SDK fetch failed on attempt ${attempt + 1}/5:`, err);
      }
      if (attempt < 4) await new Promise((r) => setTimeout(r, 5000));
    }

    if (!sdkModels || sdkModels.length === 0) {
      console.warn('[models] SDK model catalog unavailable after retries');
      resetKnownModels();
      set({
        modelCatalog: [],
        modelCatalogStatus: 'failed',
        modelsVersion: get().modelsVersion + 1,
        modelFallbackNotice: 'Unable to load Copilot model catalog from SDK. Model selection is unavailable and review launch is blocked until models can be loaded.'
      });
      return;
    }

    // Build KnownModelDefinition[] directly from SDK data
    const merged: KnownModelDefinition[] = sdkModels.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      multiplier: m.billing?.multiplier ?? 1,
      aliases: [m.name || m.id]
    }));

    // Fetch BYOK provider models and merge them into the catalog
    try {
      const byokModels = await api.listByokProviderModels();
      if (byokModels.length > 0) {
        // BYOK models: multiplier already set by fetcher (0), providerId already stamped
        merged.push(...byokModels);
      }
    } catch (err) {
      console.warn('[models] Failed to fetch BYOK provider models:', err);
    }

    updateKnownModels(merged);
    // Re-validate stored model names against the updated list
    const { modelName, workItemsSummaryModelName, settings: currentSettings } = get();
    const rawDefault = currentSettings?.defaultModel;
    const revalidatedModel = rawDefault
      ? normalizeSelectableModelId(rawDefault)
      : normalizeSelectableModelId(modelName);
    const revalidatedWiModel = rawDefault
      ? normalizeSelectableModelId(rawDefault)
      : normalizeSelectableModelId(workItemsSummaryModelName);

    if (rawDefault && revalidatedModel !== rawDefault) {
      console.warn(`[models] Stored model "${rawDefault}" not found in SDK list, falling back to "${revalidatedModel}"`);
    }

    set({
      modelsVersion: get().modelsVersion + 1,
      modelName: revalidatedModel,
      workItemsSummaryModelName: revalidatedWiModel,
      modelCatalog: sdkModels,
      modelCatalogStatus: 'ready'
    });

    const defaultModelReconciliation = reconcileSelectableModelId(rawDefault);
    if (defaultModelReconciliation.didFallbackToAuto && defaultModelReconciliation.requestedId) {
      set({
        modelFallbackNotice: `Saved model "${defaultModelReconciliation.requestedId}" is no longer available in the current Copilot model catalog. Switched to ${AUTO_MODEL_ID}.`
      });
    } else {
      set({ modelFallbackNotice: null });
    }
  }
}));
