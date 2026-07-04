/**
 * Model definitions and display helpers.
 * Single source of truth — used by App.tsx, SettingsModal.tsx, and any future model selectors.
 */

export interface KnownModelDefinition {
  id: string;
  name: string;
  multiplier: number;
  aliases: string[];
  /** Non-null for BYOK models — identifies the provider (e.g. 'byok-123'). */
  providerId?: string | null;
  /** Human-readable BYOK provider label shown in the model selector (e.g. 'Mon DeepSeek'). */
  providerLabel?: string | null;
}

export interface ModelOption {
  id: string;
  name: string;
  multiplier: number | null;
  aliases?: string[];
  providerId?: string | null;
  providerLabel?: string | null;
}

export interface ModelSelectOption {
  id: string;
  label: string;
  disabled?: boolean;
}

export interface ModelReconciliationResult {
  requestedId: string | null;
  normalizedId: string;
  didFallbackToAuto: boolean;
}

export const AUTO_MODEL_ID = 'Auto';

// ── Mutable module state rebuilt by updateKnownModels() ────────────────
// Starts empty — populated dynamically from the Copilot SDK on startup.

export let KNOWN_MODELS: KnownModelDefinition[] = [];

export let modelOptions: ModelOption[] = [];

const normalizeLookupKey = (value: string): string => value.trim().toLowerCase();
const isAutoModelValue = (value: string): boolean => normalizeLookupKey(value) === normalizeLookupKey(AUTO_MODEL_ID);

const sanitizeKnownModels = (models: KnownModelDefinition[]): KnownModelDefinition[] => {
  const seenIds = new Set<string>();
  const sanitized: KnownModelDefinition[] = [];
  for (const model of models) {
    const id = model.id?.trim();
    if (!id || isAutoModelValue(id)) {
      continue;
    }
    const normalizedId = normalizeLookupKey(id);
    if (seenIds.has(normalizedId)) {
      continue;
    }
    seenIds.add(normalizedId);
    sanitized.push({
      ...model,
      id,
      aliases: Array.from(new Set((model.aliases ?? []).map((alias) => alias.trim()).filter(Boolean)))
    });
  }
  return sanitized;
};

let FALLBACK_FREE_MODEL_ID = KNOWN_MODELS.find((model) => model.multiplier === 0)?.id ?? KNOWN_MODELS[0]?.id ?? AUTO_MODEL_ID;

let knownModelById = new Map(KNOWN_MODELS.map((model) => [model.id, model]));

let modelLookup = new Map<string, string>([
  [normalizeLookupKey(AUTO_MODEL_ID), AUTO_MODEL_ID]
]);

const rebuildLookups = () => {
  FALLBACK_FREE_MODEL_ID = KNOWN_MODELS.find((model) => model.multiplier === 0)?.id ?? KNOWN_MODELS[0]?.id ?? AUTO_MODEL_ID;
  knownModelById = new Map(KNOWN_MODELS.map((model) => [model.id, model]));
  modelLookup = new Map<string, string>([[normalizeLookupKey(AUTO_MODEL_ID), AUTO_MODEL_ID]]);
  for (const model of KNOWN_MODELS) {
    modelLookup.set(normalizeLookupKey(model.id), model.id);
    modelLookup.set(normalizeLookupKey(model.name), model.id);
    for (const alias of model.aliases) {
      modelLookup.set(normalizeLookupKey(alias), model.id);
    }
  }
  modelOptions = KNOWN_MODELS.length > 0
    ? [{ id: AUTO_MODEL_ID, name: AUTO_MODEL_ID, multiplier: null, aliases: [AUTO_MODEL_ID] }, ...KNOWN_MODELS]
    : [];
};

// Build initial lookups
rebuildLookups();

/**
 * Replace the known model list with a dynamically fetched one and rebuild
 * all lookups.  Call this after fetching models from the SDK.
 */
export const updateKnownModels = (models: KnownModelDefinition[]): void => {
  const sanitized = sanitizeKnownModels(models);
  if (sanitized.length === 0) return;
  KNOWN_MODELS = sanitized;
  rebuildLookups();
};

export const resetKnownModels = (): void => {
  KNOWN_MODELS = [];
  rebuildLookups();
};

const resolveFallback = (allowAuto: boolean, fallback: 'auto' | 'free' | 'none'): string | null => {
  if (fallback === 'free') {
    return FALLBACK_FREE_MODEL_ID;
  }
  if (fallback === 'auto' && allowAuto) {
    return AUTO_MODEL_ID;
  }
  return null;
};

export const getFallbackFreeModelId = (): string => AUTO_MODEL_ID;

export const isKnownModelId = (value: string | null | undefined): boolean => {
  const normalized = normalizeModelId(value, { allowAuto: true, fallback: 'none' });
  return normalized !== null;
};

export const normalizeModelId = (
  value: string | null | undefined,
  options?: { allowAuto?: boolean; fallback?: 'auto' | 'free' | 'none' }
): string | null => {
  const allowAuto = options?.allowAuto ?? true;
  const fallback = options?.fallback ?? 'auto';
  const trimmed = value?.trim();

  if (!trimmed) {
    return resolveFallback(allowAuto, fallback);
  }

  if (normalizeLookupKey(trimmed) === normalizeLookupKey(AUTO_MODEL_ID)) {
    return allowAuto ? AUTO_MODEL_ID : resolveFallback(false, fallback);
  }

  const normalized = modelLookup.get(normalizeLookupKey(trimmed));
  if (normalized) {
    return normalized;
  }

  // If the model list hasn't been populated yet, preserve the raw value
  // so we don't silently replace valid model IDs with "Auto".
  if (KNOWN_MODELS.length === 0) {
    return trimmed;
  }

  return resolveFallback(allowAuto, fallback);
};

export const normalizeDefaultModelId = (value: string | null | undefined): string =>
  normalizeModelId(value, { allowAuto: true, fallback: 'auto' }) ?? AUTO_MODEL_ID;

export const normalizeSelectableModelId = (value: string | null | undefined): string =>
  normalizeModelId(value, { allowAuto: true, fallback: 'auto' }) ?? AUTO_MODEL_ID;

export const normalizeConcreteModelId = (value: string | null | undefined): string =>
  normalizeModelId(value, { allowAuto: false, fallback: 'free' }) ?? FALLBACK_FREE_MODEL_ID;

export const getModelDisplayName = (value: string | null | undefined): string => {
  const trimmed = value?.trim();
  const normalized = normalizeModelId(value, { allowAuto: true, fallback: 'none' });
  if (!trimmed || normalized === AUTO_MODEL_ID) {
    return AUTO_MODEL_ID;
  }
  if (normalized) {
    return knownModelById.get(normalized)?.name ?? normalized;
  }
  return trimmed;
};

/**
 * Returns true when the given model ID resolves to a BYOK model
 * (a model with a non-null {@link KnownModelDefinition.providerId}).
 *
 * Accepts an optional model map for pure, testable usage.
 * When omitted, falls back to the module-level {@link knownModelById}.
 */
export const isByokModel = (
  modelId: string,
  knownById: Map<string, KnownModelDefinition> = knownModelById
): boolean => {
  if (!modelId || modelId === AUTO_MODEL_ID) {
    return false;
  }
  const normalized = normalizeModelId(modelId, { allowAuto: false, fallback: 'none' });
  if (!normalized) {
    return false;
  }
  const model = knownById.get(normalized);
  return model?.providerId != null;
};

export const toSdkModel = (value: string | null | undefined): string | undefined => {
  const normalized = normalizeSelectableModelId(value);
  return normalized === AUTO_MODEL_ID ? undefined : normalized;
};

export const padRight = (value: string, length: number): string =>
  value.padEnd(length, ' ').replace(/ /g, '\u00A0');

export const padLeft = (value: string, length: number): string =>
  value.padStart(length, ' ').replace(/ /g, '\u00A0');

export const formatModelLabel = (id: string, multiplier: number | null, nameWidth: number): string => {
  const displayName = getModelDisplayName(id);
  if (multiplier === null) {
    return displayName;
  }
  const paddedName = padRight(displayName, nameWidth);
  const multiplierText = padLeft(`x${multiplier}`, 5);
  return `${paddedName} ${multiplierText}`;
};

/** Format a model name with an optional BYOK provider badge. */
export const formatProviderModelLabel = (name: string, providerLabel?: string | null): string =>
  providerLabel ? `${name} (${providerLabel})` : name;

export const buildModelOptions = (): ModelSelectOption[] => {
  return modelOptions.map((model) => ({
    id: model.id,
    label: formatProviderModelLabel(model.name, model.providerLabel)
  }));
};

export const reconcileSelectableModelId = (
  value: string | null | undefined
): ModelReconciliationResult => {
  const requestedId = value?.trim() || null;
  const normalizedId = normalizeSelectableModelId(value);
  const didFallbackToAuto = Boolean(
    requestedId
    && normalizeLookupKey(requestedId) !== normalizeLookupKey(AUTO_MODEL_ID)
    && normalizedId === AUTO_MODEL_ID
    && KNOWN_MODELS.length > 0
  );
  return {
    requestedId,
    normalizedId,
    didFallbackToAuto
  };
};
