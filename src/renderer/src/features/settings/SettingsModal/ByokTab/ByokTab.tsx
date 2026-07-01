import { useState } from 'react';
import type { ByokProviderConfig, SettingsSaveIssue } from '@shared/types/models';
import { api } from '@renderer/services/api';
import { BYOK_LABELS } from './ByokTab.messages';
import styles from '../SettingsModal.module.css';

interface ByokTabProps {
  providers: ByokProviderConfig[];
  saveIssues: SettingsSaveIssue[];
  onProvidersChange: (providers: ByokProviderConfig[]) => void;
  onRequestDeleteProvider: (providerId: string) => void;
}

export default function ByokTab({
  providers,
  saveIssues,
  onProvidersChange,
  onRequestDeleteProvider
}: ByokTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [draftBaseUrl, setDraftBaseUrl] = useState('https://api.deepseek.com');
  const [draftApiKey, setDraftApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testState, setTestState] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({});
  const [testMessage, setTestMessage] = useState<Record<string, string>>({});

  const getEntityIssues = (entityId: string) =>
    saveIssues.filter((issue) => issue.scope === 'byokProvider' && issue.entityId === entityId);

  const renderIssues = (entityId: string) => {
    const issues = getEntityIssues(entityId);
    if (issues.length === 0) return null;
    return issues.map((issue, index) => (
      <div key={`${entityId}-${issue.code}-${index}`} className={`${styles.connectionResult} ${styles.connectionErr}`}>
        <i className="fa-solid fa-circle-xmark" /> {issue.message}
      </div>
    ));
  };

  const startAdd = () => {
    const id = `byok-${Date.now()}`;
    setEditingId(id);
    setDraftLabel('');
    setDraftBaseUrl('https://api.deepseek.com');
    setDraftApiKey('');
    setShowApiKey(false);
  };

  const startEdit = (provider: ByokProviderConfig) => {
    setEditingId(provider.id);
    setDraftLabel(provider.label);
    setDraftBaseUrl(provider.baseUrl || 'https://api.deepseek.com');
    setDraftApiKey('');
    setShowApiKey(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel('');
    setDraftBaseUrl('https://api.deepseek.com');
    setDraftApiKey('');
    setShowApiKey(false);
  };

  const saveProvider = async () => {
    if (!editingId) return;

    const label = draftLabel.trim();
    const baseUrl = draftBaseUrl.trim();
    const apiKey = draftApiKey.trim();
    const existing = providers.find((p) => p.id === editingId);
    const apiKeyRequired = !existing?.hasStoredApiKey;

    if (!label || (apiKeyRequired && !apiKey)) return;

    const provider: ByokProviderConfig = {
      id: editingId,
      label,
      type: 'openai',
      baseUrl: baseUrl || 'https://api.deepseek.com',
      hasStoredApiKey: existing ? existing.hasStoredApiKey || Boolean(apiKey) : true
    };

    try {
      const result = await api.saveByokProvider(provider, apiKey);
      onProvidersChange(result.settings.byokProviders ?? []);
      cancelEdit();
    } catch (err: unknown) {
      console.error('[ByokTab] Failed to save provider:', err);
    }
  };

  const testConnection = async (id: string, baseUrl: string) => {
    const key = draftApiKey.trim();
    const existing = providers.find((p) => p.id === id);

    setTestState((prev) => ({ ...prev, [id]: 'testing' }));
    setTestMessage((prev) => ({ ...prev, [id]: '' }));

    try {
      const result = await api.testByokConnection(id, key, draftBaseUrl);
      setTestState((prev) => ({ ...prev, [id]: result.ok ? 'ok' : 'error' }));
      setTestMessage((prev) => ({ ...prev, [id]: result.message }));
    } catch (err: unknown) {
      setTestState((prev) => ({ ...prev, [id]: 'error' }));
      setTestMessage((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : String(err) }));
    }
  };

  const renderForm = (id: string) => {
    const existing = providers.find((p) => p.id === id);
    const state = testState[id] ?? 'idle';
    const msg = testMessage[id] ?? '';
    const apiKeyRequired = !existing?.hasStoredApiKey;
    const canSave = Boolean(draftLabel.trim()) && (!apiKeyRequired || Boolean(draftApiKey.trim()));
    const canTest = Boolean(draftLabel.trim()) && (Boolean(draftApiKey.trim()) || (existing && existing.hasStoredApiKey));

    return (
      <div key={id} className={styles.adoCard}>
        <label className="form-label">
          {BYOK_LABELS.providerLabel}
          <input
            className="input"
            type="text"
            value={draftLabel}
            onChange={(e) => setDraftLabel(e.target.value)}
            placeholder={BYOK_LABELS.providerLabelPlaceholder}
            autoFocus
          />
        </label>

        <label className="form-label">
          {BYOK_LABELS.baseUrl}
          <input
            className="input"
            type="text"
            value={draftBaseUrl}
            onChange={(e) => setDraftBaseUrl(e.target.value)}
            placeholder={BYOK_LABELS.baseUrlPlaceholder}
          />
        </label>

        <label className="form-label">
          {BYOK_LABELS.apiKey}
          {apiKeyRequired && <span className={styles.adoCardMuted}> {BYOK_LABELS.apiKeyRequired}</span>}
          {!apiKeyRequired && <span className={styles.adoCardMuted}> {BYOK_LABELS.apiKeyKeepStored}</span>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              className="input"
              type={showApiKey ? 'text' : 'password'}
              value={draftApiKey}
              onChange={(e) => setDraftApiKey(e.target.value)}
              placeholder={apiKeyRequired ? BYOK_LABELS.apiKeyPlaceholder : BYOK_LABELS.apiKeyReplacePlaceholder}
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setShowApiKey((prev) => !prev)}
              title={showApiKey ? BYOK_LABELS.hideApiKey : BYOK_LABELS.showApiKey}
            >
              <i className={`fa-solid ${showApiKey ? 'fa-eye-slash' : 'fa-eye'}`} />
            </button>
          </div>
        </label>

        {renderIssues(id)}

        {state !== 'idle' && (
          <div className={`${styles.connectionResult} ${state === 'ok' ? styles.connectionOk : state === 'error' ? styles.connectionErr : ''}`}>
            {state === 'testing' && <><i className="fa-solid fa-spinner fa-spin" /> {BYOK_LABELS.testing}</>}
            {state === 'ok' && <><i className="fa-solid fa-circle-check" /> {msg}</>}
            {state === 'error' && <><i className="fa-solid fa-circle-xmark" /> {msg}</>}
          </div>
        )}

        <div className={styles.adoCardActions}>
          <button className="btn btn-sm" onClick={cancelEdit}>{BYOK_LABELS.cancel}</button>
          <button
            className="btn btn-sm"
            onClick={() => testConnection(id, draftBaseUrl)}
            disabled={!canTest || state === 'testing'}
          >
            {state === 'testing' ? <><i className="fa-solid fa-spinner fa-spin" /></> : <><i className="fa-solid fa-plug" /></>}
          </button>
          <button className="btn btn-sm accent" onClick={saveProvider} disabled={!canSave}>
            <i className="fa-solid fa-check" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.adoSection}>
      <div className={styles.adoSectionHeader}>
        <h3 className={styles.adoSectionTitle}>
          <i className="fa-solid fa-robot" /> {BYOK_LABELS.heading}
        </h3>
        <button className="btn btn-sm" type="button" onClick={startAdd} disabled={editingId !== null}>
          <i className="fa-solid fa-plus" /> {BYOK_LABELS.addProvider}
        </button>
      </div>

      <p className="helper">{BYOK_LABELS.helper}</p>

      {providers.length === 0 && editingId === null && (
        <p className="helper">{BYOK_LABELS.noProviders}</p>
      )}

      {providers.map((provider) =>
        editingId === provider.id ? (
          renderForm(provider.id)
        ) : (
          <div key={provider.id} className={styles.adoCard}>
            <div className={styles.adoCardRow}>
              <span className={styles.adoCardLabel}>{provider.label}</span>
              <span className={styles.adoCardMuted}>{provider.baseUrl}</span>
              <span className={styles.adoCardMuted}>
                {provider.hasStoredApiKey ? (
                  <><i className="fa-solid fa-shield-halved" /> {BYOK_LABELS.apiKeyStored}</>
                ) : (
                  <><i className="fa-solid fa-triangle-exclamation" /> {BYOK_LABELS.apiKeyMissing}</>
                )}
              </span>
              <div className={styles.adoCardActions}>
                <button className="btn btn-sm" type="button" onClick={() => onRequestDeleteProvider(provider.id)}>
                  <i className="fa-solid fa-trash" />
                </button>
                <button className="btn btn-sm" type="button" onClick={() => startEdit(provider)}>
                  <i className="fa-solid fa-pen" />
                </button>
              </div>
            </div>
          </div>
        )
      )}

      {editingId && !providers.some((p) => p.id === editingId) && renderForm(editingId)}
    </div>
  );
}
