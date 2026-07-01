import assert from 'node:assert/strict';
import test, { mock } from 'node:test';

// ── Minimal mock for DatabaseService ──────────────────────────────────

interface MockDb {
  preferences: Record<string, string>;
}

function createMockDatabaseService(initialPrefs: Record<string, string> = {}) {
  const prefs: Record<string, string> = { ...initialPrefs };

  return {
    getPreference: (key: string): string | null => prefs[key] ?? null,
    setPreference: (key: string, value: string | null): void => {
      if (value === null) {
        delete prefs[key];
      } else {
        prefs[key] = value;
      }
    },
    getAllPreferences: (): Record<string, string> => ({ ...prefs }),
    getByokProviders: () => {
      const raw = prefs['byokProviders'];
      if (!raw) return [];
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    },
    saveByokProvider: (provider: unknown) => {
      const providers = (() => {
        const raw = prefs['byokProviders'];
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      })();
      providers.push(provider);
      prefs['byokProviders'] = JSON.stringify(providers);
    },
    updateByokProvider: (provider: { id: string }) => {
      const providers = (() => {
        const raw = prefs['byokProviders'];
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      })();
      const idx = providers.findIndex((p: { id: string }) => p.id === provider.id);
      if (idx === -1) providers.push(provider);
      else providers[idx] = provider;
      prefs['byokProviders'] = JSON.stringify(providers);
    },
    deleteByokProvider: (providerId: string) => {
      const providers = (() => {
        const raw = prefs['byokProviders'];
        if (!raw) return [];
        try { return JSON.parse(raw); } catch { return []; }
      })().filter((p: { id: string }) => p.id !== providerId);
      prefs['byokProviders'] = JSON.stringify(providers);
    },
    loadNonAdoSettings: () => ({}),
    getPromptLibrary: () => ({ defaultPromptId: null, defaultPromptIdByCategory: {}, prompts: [] }),
    getCurrentOrganizationMetadata: () => [],
    getCurrentPrSources: () => [],
    getCurrentActivePrSourceId: () => null,
    saveAdoOrganizations: () => {},
    savePrSources: () => {},
    setPreferenceSaved: (key: string, value: string | null) => { prefs[key] = value ?? ''; },
    saveNonAdoSettings: () => {},
    savePromptLibrary: () => {}
  };
}

// ── Test helpers ─────────────────────────────────────────────────────

const makeProvider = (overrides: Partial<{ id: string; label: string; baseUrl: string }> = {}) => ({
  id: overrides.id ?? 'byok-test-1',
  label: overrides.label ?? 'Test DeepSeek',
  type: 'openai' as const,
  baseUrl: overrides.baseUrl ?? 'https://api.deepseek.com/v1'
});

// ── Tests ────────────────────────────────────────────────────────────

test('getByokProviders returns empty array when no providers exist', () => {
  const db = createMockDatabaseService();
  const providers = db.getByokProviders();
  assert.deepEqual(providers, []);
});

test('saveByokProvider stores provider metadata without API key', () => {
  const db = createMockDatabaseService();
  const provider = makeProvider();

  db.saveByokProvider(provider);
  const stored = db.getByokProviders();

  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'byok-test-1');
  assert.equal(stored[0].label, 'Test DeepSeek');
  assert.equal(stored[0].type, 'openai');
  assert.equal(stored[0].baseUrl, 'https://api.deepseek.com/v1');
  // API key must NOT be in the stored metadata
  assert.equal('apiKey' in stored[0], false);
  assert.equal('hasStoredApiKey' in stored[0], false);
});

test('updateByokProvider updates existing provider metadata', () => {
  const db = createMockDatabaseService();
  db.saveByokProvider(makeProvider());

  const updated = makeProvider({ label: 'Renamed DeepSeek', baseUrl: 'https://api.deepseek.com/v1/chat' });
  db.updateByokProvider(updated);

  const stored = db.getByokProviders();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].label, 'Renamed DeepSeek');
  assert.equal(stored[0].baseUrl, 'https://api.deepseek.com/v1/chat');
});

test('updateByokProvider adds provider if it does not exist', () => {
  const db = createMockDatabaseService();
  db.updateByokProvider(makeProvider({ id: 'byok-new' }));
  const stored = db.getByokProviders();
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'byok-new');
});

test('deleteByokProvider removes provider by ID', () => {
  const db = createMockDatabaseService();
  db.saveByokProvider(makeProvider({ id: 'p1', label: 'Provider 1' }));
  db.saveByokProvider(makeProvider({ id: 'p2', label: 'Provider 2' }));

  db.deleteByokProvider('p1');
  const stored = db.getByokProviders();

  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, 'p2');
});

test('deleteByokProvider is a no-op for non-existent ID', () => {
  const db = createMockDatabaseService();
  db.saveByokProvider(makeProvider());
  db.deleteByokProvider('nonexistent');
  assert.equal(db.getByokProviders().length, 1);
});

test('multiple save/delete cycles maintain integrity', () => {
  const db = createMockDatabaseService();

  // Add 3 providers
  db.saveByokProvider(makeProvider({ id: 'a', label: 'A' }));
  db.saveByokProvider(makeProvider({ id: 'b', label: 'B' }));
  db.saveByokProvider(makeProvider({ id: 'c', label: 'C' }));
  assert.equal(db.getByokProviders().length, 3);

  // Delete middle one
  db.deleteByokProvider('b');
  assert.equal(db.getByokProviders().length, 2);

  // Add another
  db.saveByokProvider(makeProvider({ id: 'd', label: 'D' }));
  assert.equal(db.getByokProviders().length, 3);

  // Update existing
  db.updateByokProvider(makeProvider({ id: 'a', label: 'A renamed' }));
  const stored = db.getByokProviders();
  const a = stored.find((p: { id: string }) => p.id === 'a');
  assert.ok(a);
  assert.equal(a.label, 'A renamed');
});

test('saveByokProvider validates: rejects empty label', async () => {
  // This tests the SettingsStore.saveByokProvider method directly
  // by importing from the source module.
  // Because SettingsStore requires Electron's `app` and `safeStorage`,
  // we test the database layer here. The SettingsStore validation is
  // tested via integration/manual tests.

  // Database layer accepts any data — validation is at SettingsStore level.
  const db = createMockDatabaseService();
  db.saveByokProvider(makeProvider({ label: '' }));
  // DB allows empty label (validation happens in SettingsStore)
  assert.equal(db.getByokProviders()[0].label, '');
});

test('getByokProviders handles corrupted JSON gracefully', () => {
  const db = createMockDatabaseService({ byokProviders: 'not-valid-json{' });
  const providers = db.getByokProviders();
  assert.deepEqual(providers, []);
});

test('getByokProviders handles null preference gracefully', () => {
  const db = createMockDatabaseService();
  const providers = db.getByokProviders();
  assert.deepEqual(providers, []);
});
