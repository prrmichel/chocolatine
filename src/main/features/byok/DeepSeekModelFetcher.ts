import type { KnownModelDefinition } from '@shared/constants/modelOptions';

const DEEPSEEK_HARDCODED_MODELS: KnownModelDefinition[] = [
  { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: ['deepseek-chat'], providerId: null, providerLabel: null },
  { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', multiplier: 0, aliases: ['deepseek-reasoner'], providerId: null, providerLabel: null }
];

interface CacheEntry {
  models: KnownModelDefinition[];
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Fetches available models from a DeepSeek-compatible API endpoint.
 * Caches results for 1 hour and falls back to a hardcoded list on failure.
 *
 * The `providerId` is stamped on every returned model so consumers
 * can tell which provider each model belongs to.
 */
export class DeepSeekModelFetcher {
  private cache = new Map<string, CacheEntry>();

  /** Fetch models for a given provider. Returns cached results when fresh. */
  async fetchModels(providerId: string, baseUrl: string, apiKey: string, providerLabel?: string): Promise<KnownModelDefinition[]> {
    const cached = this.cache.get(providerId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.models;
    }

    try {
      const models = await this.fetchFromApi(baseUrl, apiKey, providerId, providerLabel);
      this.cache.set(providerId, { models, fetchedAt: Date.now() });
      return models;
    } catch (err) {
      console.warn(`[DeepSeekModelFetcher] API fetch failed for provider "${providerId}", using fallback.`, err);
      const fallback = DEEPSEEK_HARDCODED_MODELS.map((m) => ({ ...m, providerId, providerLabel: providerLabel ?? null }));
      this.cache.set(providerId, { models: fallback, fetchedAt: Date.now() });
      return fallback;
    }
  }

  /** Clear cached models for a specific provider (e.g. when API key changes). */
  clearCache(providerId: string): void {
    this.cache.delete(providerId);
  }

  /** Clear all cached models. */
  clearAllCache(): void {
    this.cache.clear();
  }

  /** Synchronously return cached models for a provider (no fetch). Returns empty if not cached. */
  getCachedModels(providerId: string): KnownModelDefinition[] {
    const cached = this.cache.get(providerId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.models;
    }
    return [];
  }

  private async fetchFromApi(baseUrl: string, apiKey: string, providerId: string, providerLabel?: string): Promise<KnownModelDefinition[]> {
    const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
    const url = `${normalizedBaseUrl}/v1/models`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json'
      },
      signal: AbortSignal.timeout(15_000)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { data?: Array<{ id: string }> };
    const modelIds = (data.data ?? []).map((m) => m.id).filter(Boolean);

    if (modelIds.length === 0) {
      // API returned no models — use fallback
      throw new Error('No models returned from API');
    }

    return modelIds.map((id) => ({
      id,
      name: id,
      multiplier: 0,
      aliases: [id],
      providerId,
      providerLabel: providerLabel ?? null
    }));
  }
}
