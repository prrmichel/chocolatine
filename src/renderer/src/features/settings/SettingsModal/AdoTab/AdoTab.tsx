import { useState } from 'react';
import { AdoOrganization, PrSource, SettingsSaveIssue } from '@shared/types/models';
import { api } from '@renderer/services/api';
import { LABELS } from '../SettingsModal.messages';
import styles from '../SettingsModal.module.css';

interface AdoTabProps {
  organizations: AdoOrganization[];
  prSources: PrSource[];
  myDisplayName: string;
  saveIssues: SettingsSaveIssue[];
  onOrganizationsChange: (orgs: AdoOrganization[]) => void;
  onPrSourcesChange: (sources: PrSource[]) => void;
  onDisplayNameChange: (value: string) => void;
  onRequestDeleteOrganization: (organizationId: string) => void;
}

export default function AdoTab({
  organizations,
  prSources,
  myDisplayName,
  saveIssues,
  onOrganizationsChange,
  onPrSourcesChange,
  onDisplayNameChange,
  onRequestDeleteOrganization
}: AdoTabProps) {
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [orgDraftName, setOrgDraftName] = useState('');
  const [orgDraftPat, setOrgDraftPat] = useState('');
  const [orgTestState, setOrgTestState] = useState<Record<string, 'idle' | 'testing' | 'ok' | 'error'>>({});
  const [orgTestMessage, setOrgTestMessage] = useState<Record<string, string>>({});
  const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
  const [srcDraftName, setSrcDraftName] = useState('');
  const [srcDraftOrgId, setSrcDraftOrgId] = useState('');
  const [srcDraftProject, setSrcDraftProject] = useState('');
  const [srcDraftRepository, setSrcDraftRepository] = useState('');

  const getEntityIssues = (scope: 'organization' | 'prSource', entityId: string) =>
    saveIssues.filter((issue) => issue.scope === scope && issue.entityId === entityId);

  const renderIssues = (scope: 'organization' | 'prSource', entityId: string) => {
    const issues = getEntityIssues(scope, entityId);
    if (issues.length === 0) {
      return null;
    }

    return issues.map((issue, index) => (
      <div key={`${entityId}-${issue.code}-${index}`} className={`${styles.connectionResult} ${styles.connectionErr}`}>
        <i className="fa-solid fa-circle-xmark" /> {issue.message}
      </div>
    ));
  };

  const startAddOrg = () => {
    const id = `org-${Date.now()}`;
    setEditingOrgId(id);
    setOrgDraftName('');
    setOrgDraftPat('');
  };

  const startEditOrg = (org: AdoOrganization) => {
    setEditingOrgId(org.id);
    setOrgDraftName(org.name);
    setOrgDraftPat('');
  };

  const cancelEditOrg = () => {
    setEditingOrgId(null);
    setOrgDraftName('');
    setOrgDraftPat('');
  };

  const saveOrg = () => {
    if (!editingOrgId) {
      return;
    }

    const name = orgDraftName.trim();
    const pat = orgDraftPat.trim();
    const existing = organizations.find((org) => org.id === editingOrgId);
    const patRequired = !existing?.hasStoredPat;

    if (!name || (patRequired && !pat)) {
      return;
    }

    const nextOrg: AdoOrganization = {
      id: editingOrgId,
      name,
      pat,
      hasStoredPat: existing ? existing.hasStoredPat || Boolean(pat) : true
    };

    if (existing) {
      onOrganizationsChange(organizations.map((org) => (org.id === editingOrgId ? nextOrg : org)));
    } else {
      onOrganizationsChange([...organizations, nextOrg]);
    }

    cancelEditOrg();
  };

  const testOrganization = async (id: string, orgName: string, pat: string) => {
    const trimmedName = orgName.trim();
    const trimmedPat = pat.trim();
    const existing = organizations.find((org) => org.id === id);

    if (!trimmedName) {
      setOrgTestState((prev) => ({ ...prev, [id]: 'error' }));
      setOrgTestMessage((prev) => ({ ...prev, [id]: 'Organization name is required.' }));
      return;
    }

    setOrgTestState((prev) => ({ ...prev, [id]: 'testing' }));
    setOrgTestMessage((prev) => ({ ...prev, [id]: '' }));

    try {
      const result = trimmedPat
        ? await api.testOrgConnection(trimmedName, trimmedPat)
        : existing?.hasStoredPat
          ? await api.testStoredOrgConnection(id, trimmedName)
          : { ok: false, message: existing ? LABELS.orgPatMissingStored : LABELS.orgPatRequired };
      setOrgTestState((prev) => ({ ...prev, [id]: result.ok ? 'ok' : 'error' }));
      setOrgTestMessage((prev) => ({ ...prev, [id]: result.message }));
    } catch (err: unknown) {
      setOrgTestState((prev) => ({ ...prev, [id]: 'error' }));
      setOrgTestMessage((prev) => ({ ...prev, [id]: err instanceof Error ? err.message : String(err) }));
    }
  };

  const startAddSource = () => {
    const id = `src-${Date.now()}`;
    setEditingSourceId(id);
    setSrcDraftName('');
    setSrcDraftOrgId(organizations[0]?.id ?? '');
    setSrcDraftProject('');
    setSrcDraftRepository('');
  };

  const startEditSource = (src: PrSource) => {
    setEditingSourceId(src.id);
    setSrcDraftName(src.name);
    setSrcDraftOrgId(src.organizationId);
    setSrcDraftProject(src.project);
    setSrcDraftRepository(src.repository ?? '');
  };

  const cancelEditSource = () => {
    setEditingSourceId(null);
    setSrcDraftName('');
    setSrcDraftOrgId('');
    setSrcDraftProject('');
    setSrcDraftRepository('');
  };

  const saveSource = () => {
    if (!editingSourceId) {
      return;
    }

    const entry: PrSource = {
      id: editingSourceId,
      name: srcDraftName.trim(),
      organizationId: srcDraftOrgId,
      project: srcDraftProject.trim(),
      repository: srcDraftRepository.trim() || null
    };

    if (!entry.name || !entry.organizationId || !entry.project) {
      return;
    }

    const exists = prSources.find((source) => source.id === editingSourceId);
    if (exists) {
      onPrSourcesChange(prSources.map((source) => (source.id === editingSourceId ? entry : source)));
    } else {
      onPrSourcesChange([...prSources, entry]);
    }

    cancelEditSource();
  };

  const deleteSource = (id: string) => {
    onPrSourcesChange(prSources.filter((source) => source.id !== id));
  };

  const renderOrgForm = (id: string) => {
    const existing = organizations.find((org) => org.id === id);
    const testState = orgTestState[id] ?? 'idle';
    const testMsg = orgTestMessage[id] ?? '';
    const patRequired = !existing?.hasStoredPat;
    const canSave = Boolean(orgDraftName.trim()) && (!patRequired || Boolean(orgDraftPat.trim()));
    const canTest = Boolean(orgDraftName.trim()) && (Boolean(orgDraftPat.trim()) || Boolean(existing?.hasStoredPat));

    return (
      <div key={id} className={styles.adoCard}>
        <label className="form-label">
          {LABELS.orgName}
          <input className="input" type="text" value={orgDraftName} onChange={(event) => setOrgDraftName(event.target.value)} autoFocus />
        </label>
        {orgDraftName.trim() && (
          <a
            className={styles.tokenLink}
            href={`https://dev.azure.com/${encodeURIComponent(orgDraftName.trim())}/_usersSettings/tokens`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <i className="fa-solid fa-arrow-up-right-from-square" /> {LABELS.orgTokenLink}
          </a>
        )}
        <label className="form-label">
          {LABELS.orgPat}
          <input className="input" type="password" value={orgDraftPat} onChange={(event) => setOrgDraftPat(event.target.value)} />
        </label>
        <p className="helper helper-compact">
          {existing?.hasStoredPat
            ? LABELS.orgPatKeepStored
            : existing
              ? LABELS.orgPatMissingStored
              : LABELS.orgPatRequired}
        </p>
        {existing?.hasStoredPat && <p className="helper helper-compact">{LABELS.orgPatReplaceStored}</p>}
        <div className={styles.adoCardActions}>
          <button className="btn btn-sm" type="button" onClick={saveOrg} disabled={!canSave}>
            <i className="fa-solid fa-check" /> {LABELS.save}
          </button>
          <button className="btn btn-sm" type="button" onClick={cancelEditOrg}>{LABELS.cancel}</button>
          {canTest && (
            <button className="btn btn-sm" type="button" onClick={() => void testOrganization(id, orgDraftName, orgDraftPat)} disabled={testState === 'testing'}>
              {testState === 'testing'
                ? <><i className="fa-solid fa-spinner fa-spin" /> {LABELS.testingOrgConnection}</>
                : <><i className="fa-solid fa-plug" /> {LABELS.testOrgConnection}</>}
            </button>
          )}
        </div>
        {testState !== 'idle' && testState !== 'testing' && (
          <div className={`${styles.connectionResult} ${testState === 'ok' ? styles.connectionOk : styles.connectionErr}`}>
            <i className={`fa-solid ${testState === 'ok' ? 'fa-circle-check' : 'fa-circle-xmark'}`} /> {testMsg}
          </div>
        )}
        {renderIssues('organization', id)}
      </div>
    );
  };

  const renderSourceForm = (id: string) => (
    <div key={id} className={styles.adoCard}>
      <label className="form-label">
        {LABELS.prSourceName}
        <input className="input" type="text" value={srcDraftName} onChange={(event) => setSrcDraftName(event.target.value)} autoFocus />
      </label>
      <label className="form-label">
        {LABELS.prSourceOrganization}
        <select className="select" value={srcDraftOrgId} onChange={(event) => setSrcDraftOrgId(event.target.value)}>
          <option value="">{LABELS.prSourceSelectOrg}</option>
          {organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}
        </select>
      </label>
      <label className="form-label">
        {LABELS.prSourceProject}
        <input className="input" type="text" value={srcDraftProject} onChange={(event) => setSrcDraftProject(event.target.value)} />
      </label>
      <label className="form-label">
        {LABELS.prSourceRepository}
        <input className="input" type="text" value={srcDraftRepository} onChange={(event) => setSrcDraftRepository(event.target.value)} placeholder="All repositories" />
      </label>
      <div className={styles.adoCardActions}>
        <button className="btn btn-sm" type="button" onClick={saveSource} disabled={!srcDraftName.trim() || !srcDraftOrgId || !srcDraftProject.trim()}>
          <i className="fa-solid fa-check" /> {LABELS.save}
        </button>
        <button className="btn btn-sm" type="button" onClick={cancelEditSource}>{LABELS.cancel}</button>
      </div>
      {renderIssues('prSource', id)}
    </div>
  );

  return (
    <>
      <div className={styles.adoSection}>
        <div className={styles.adoSectionHeader}>
          <h3 className={styles.adoSectionTitle}>
            <i className="fa-solid fa-building" /> {LABELS.organizationsHeading}
          </h3>
          <button className="btn btn-sm" type="button" onClick={startAddOrg} disabled={editingOrgId !== null}>
            <i className="fa-solid fa-plus" /> {LABELS.addOrganization}
          </button>
        </div>

        {organizations.map((org) => {
          if (editingOrgId === org.id) {
            return renderOrgForm(org.id);
          }

          const testState = orgTestState[org.id] ?? 'idle';
          const testMsg = orgTestMessage[org.id] ?? '';
          return (
            <div key={org.id} className={styles.adoCard}>
              <div className={styles.adoCardRow}>
                <span className={styles.adoCardLabel}>{org.name}</span>
                <span className={styles.adoCardMuted}>
                  {org.hasStoredPat ? LABELS.storedPatLabel : LABELS.missingPatLabel}
                </span>
                <div className={styles.adoCardActions}>
                  <button className="btn btn-sm" type="button" onClick={() => void testOrganization(org.id, org.name, '')} disabled={testState === 'testing' || !org.hasStoredPat}>
                    {testState === 'testing' ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-plug" />}
                  </button>
                  <button className="btn btn-sm" type="button" onClick={() => startEditOrg(org)} disabled={editingOrgId !== null}>
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => onRequestDeleteOrganization(org.id)}
                    disabled={editingOrgId !== null || editingSourceId !== null}
                  >
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
              {testState !== 'idle' && testState !== 'testing' && (
                <div className={`${styles.connectionResult} ${testState === 'ok' ? styles.connectionOk : styles.connectionErr}`}>
                  <i className={`fa-solid ${testState === 'ok' ? 'fa-circle-check' : 'fa-circle-xmark'}`} /> {testMsg}
                </div>
              )}
              {renderIssues('organization', org.id)}
            </div>
          );
        })}

        {editingOrgId && !organizations.find((org) => org.id === editingOrgId) && renderOrgForm(editingOrgId)}

        {organizations.length === 0 && !editingOrgId && (
          <p className="helper helper-compact">No organizations configured yet.</p>
        )}
      </div>

      <div className={styles.adoSection}>
        <div className={styles.adoSectionHeader}>
          <h3 className={styles.adoSectionTitle}>
            <i className="fa-solid fa-code-branch" /> {LABELS.prSourcesHeading}
          </h3>
          <button className="btn btn-sm" type="button" onClick={startAddSource} disabled={editingSourceId !== null || organizations.length === 0}>
            <i className="fa-solid fa-plus" /> {LABELS.addPrSource}
          </button>
        </div>

        {prSources.map((source) => {
          if (editingSourceId === source.id) {
            return renderSourceForm(source.id);
          }

          const organizationName = organizations.find((organization) => organization.id === source.organizationId)?.name ?? '?';
          return (
            <div key={source.id} className={styles.adoCard}>
              <div className={styles.adoCardRow}>
                <span className={styles.adoCardLabel}>{source.name}</span>
                <span className={styles.adoCardMuted}>
                  {organizationName} / {source.project}{source.repository ? ` / ${source.repository}` : ''}
                </span>
                <div className={styles.adoCardActions}>
                  <button className="btn btn-sm" type="button" onClick={() => startEditSource(source)} disabled={editingSourceId !== null}>
                    <i className="fa-solid fa-pen" />
                  </button>
                  <button className="btn btn-sm" type="button" onClick={() => deleteSource(source.id)} disabled={editingOrgId !== null || editingSourceId !== null}>
                    <i className="fa-solid fa-trash" />
                  </button>
                </div>
              </div>
              {renderIssues('prSource', source.id)}
            </div>
          );
        })}

        {editingSourceId && !prSources.find((source) => source.id === editingSourceId) && renderSourceForm(editingSourceId)}

        {prSources.length === 0 && !editingSourceId && (
          <p className="helper helper-compact">No PR sources configured yet. Add an organization first.</p>
        )}
      </div>

      <div className={styles.adoSection}>
        <label className="form-label">
          {LABELS.displayName}
          <input
            className="input"
            type="text"
            value={myDisplayName}
            placeholder={LABELS.displayNamePlaceholder}
            onChange={(event) => onDisplayNameChange(event.target.value)}
          />
        </label>
        <p className="helper">{LABELS.displayNameHelper}</p>
      </div>

      <p className="helper">{LABELS.adoHelper}</p>
    </>
  );
}
