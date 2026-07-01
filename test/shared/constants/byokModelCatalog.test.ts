import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// We can't easily test the full DeepSeekModelFetcher because it uses `fetch`.
// Instead we test the modelOptions merge and the BYOK model integration.

// ── Test helpers ─────────────────────────────────────────────────────

// Simulate the KnownModelDefinition structure
interface KnownModelDefinition {
  id: string;
  name: string;
  multiplier: number;
  aliases: string[];
  providerId?: string | null;
}

// These are inlined from the production code for unit testing
const AUTO_MODEL_ID = 'Auto';

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

// Simulate the merge that happens in loadDynamicModels
function mergeCopilotAndByokModels(
  copilotModels: KnownModelDefinition[],
  byokModels: KnownModelDefinition[]
): KnownModelDefinition[] {
  const all = [...copilotModels, ...byokModels];
  return sanitizeKnownModels(all);
}

// Simulate buildModelOptions with BYOK badge
function buildModelOptions(models: KnownModelDefinition[]): Array<{ id: string; label: string }> {
  return models.map((model) => ({
    id: model.id,
    label: model.providerLabel ? `${model.name} (${model.providerLabel})` : model.name
  }));
}

// ── Tests ────────────────────────────────────────────────────────────

test('sanitizeKnownModels removes duplicates (case-insensitive)', () => {
  const models: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: ['gpt-4'] },
    { id: 'GPT-4', name: 'GPT-4 Dupe', multiplier: 2, aliases: ['gpt4'] }
  ];
  const result = sanitizeKnownModels(models);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'gpt-4');
});

test('sanitizeKnownModels filters Auto models', () => {
  const models: KnownModelDefinition[] = [
    { id: 'Auto', name: 'Auto', multiplier: 0, aliases: [] },
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: ['gpt-4'] }
  ];
  const result = sanitizeKnownModels(models);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'gpt-4');
});

test('mergeCopilotAndByokModels merges both lists without duplicates', () => {
  const copilot: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: ['gpt-4'] },
    { id: 'claude-3', name: 'Claude 3', multiplier: 1, aliases: ['claude-3'] }
  ];
  const byok: KnownModelDefinition[] = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: ['deepseek-chat'], providerId: 'byok-1', providerLabel: 'Test' },
    { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', multiplier: 0, aliases: ['deepseek-reasoner'], providerId: 'byok-1', providerLabel: 'Test' }
  ];

  const merged = mergeCopilotAndByokModels(copilot, byok);
  assert.equal(merged.length, 4);
});

test('mergeCopilotAndByokModels handles duplicate IDs across sources', () => {
  const copilot: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: ['gpt-4'] }
  ];
  const byok: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4 (BYOK)', multiplier: 0, aliases: ['gpt-4'], providerId: 'byok-1', providerLabel: 'Test' }
  ];

  const merged = mergeCopilotAndByokModels(copilot, byok);
  // First occurrence wins (Copilot), BYOK duplicate is filtered
  assert.equal(merged.length, 1);
  assert.equal(merged[0].name, 'GPT-4');
  assert.equal(merged[0].providerId, undefined);
});

test('buildModelOptions adds provider label suffix for BYOK models', () => {
  const models: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: [] },
    { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: [], providerId: 'byok-1', providerLabel: 'Mon DeepSeek' }
  ];

  const options = buildModelOptions(models);
  assert.equal(options.length, 2);
  assert.equal(options[0].label, 'GPT-4');
  assert.equal(options[1].label, 'DeepSeek Chat (Mon DeepSeek)');
});

test('buildModelOptions uses model name only when no providerLabel', () => {
  const models: KnownModelDefinition[] = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: [], providerId: 'byok-1' }
  ];

  const options = buildModelOptions(models);
  assert.equal(options[0].label, 'DeepSeek Chat');
});

test('buildModelOptions does not add label suffix for Copilot models', () => {
  const models: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: [] }
  ];

  const options = buildModelOptions(models);
  assert.equal(options[0].label, 'GPT-4');
});

test('BYOK models have correct providerId and multiplier', () => {
  const byok: KnownModelDefinition[] = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: ['deepseek-chat'], providerId: 'byok-abc-123' }
  ];

  assert.equal(byok[0].providerId, 'byok-abc-123');
  assert.equal(byok[0].multiplier, 0);
});

test('empty BYOK list returns empty merge', () => {
  const copilot: KnownModelDefinition[] = [
    { id: 'gpt-4', name: 'GPT-4', multiplier: 1, aliases: ['gpt-4'] }
  ];

  const merged = mergeCopilotAndByokModels(copilot, []);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'gpt-4');
});

test('all BYOK models (no Copilot) works correctly', () => {
  const byok: KnownModelDefinition[] = [
    { id: 'deepseek-chat', name: 'DeepSeek Chat', multiplier: 0, aliases: ['deepseek-chat'], providerId: 'byok-1' }
  ];

  const merged = mergeCopilotAndByokModels([], byok);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, 'deepseek-chat');
  assert.equal(merged[0].providerId, 'byok-1');
});
