import { useEffect, useRef, useState } from 'react';
import { getFallbackFreeModelId, normalizeDefaultModelId } from '@shared/constants/modelOptions';
import { AdoOrganization, AppSettings, ByokProviderConfig, PrSource, SettingsSaveIssue, SettingsSaveResult } from '@shared/types/models';
import { api } from '@renderer/services/api';
import type { SettingsTabId } from '@renderer/stores/app/useUIStore';
import ConfirmDialog from '@renderer/features/shared/ConfirmDialog/ConfirmDialog';
import AdoTab from './AdoTab/AdoTab';
import ByokTab from './ByokTab/ByokTab';
import PreferencesTab from './PreferencesTab/PreferencesTab';
import DataTab from './DataTab/DataTab';
import {
  LABELS,
  BYOK_DELETE_LABELS,
  buildDeleteOrganizationCascadeMessage,
  buildDeleteOrganizationMessage,
  buildDeleteByokProviderMessage,
  confirmPurgeMessage,
  purgeResultMessage
} from './SettingsModal.messages';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  isOpen: boolean;
  initialTab?: SettingsTabId;
  settings: AppSettings | null;
  onClose: () => void;
  onSave: (settings: AppSettings) => Promise<SettingsSaveResult> | SettingsSaveResult;
  onClearPersistedReviews: () => Promise<void> | void;
  onClearPersistedReviewsForCompletedPullRequests: () => Promise<void> | void;
}

interface ConfirmAction {
  title: string;
  message: string;
  confirmLabel?: string;
  action: () => void | Promise<void>;
}

interface SaveFeedback {
  message: string | null;
  issues: SettingsSaveIssue[];
}

export default function SettingsModal({
  isOpen,
  initialTab = 'ado',
  settings,
  onClose,
  onSave,
  onClearPersistedReviews,
  onClearPersistedReviewsForCompletedPullRequests
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>('ado');
  const [organizations, setOrganizations] = useState<AdoOrganization[]>([]);
  const [prSources, setPrSources] = useState<PrSource[]>([]);
  const [byokProviders, setByokProviders] = useState<ByokProviderConfig[]>([]);
  const [defaultModel, setDefaultModel] = useState(getFallbackFreeModelId());
  const [defaultDiffViewMode, setDefaultDiffViewMode] = useState<'inline' | 'side'>('inline');
  const [myDisplayName, setMyDisplayName] = useState('');
  const [reviewWorktreeRootFolder, setReviewWorktreeRootFolder] = useState('');
  const [databaseFolder, setDatabaseFolder] = useState('');
  const [purgeMessage, setPurgeMessage] = useState('');
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<SaveFeedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const initializedRef = useRef(false);

  const clearSaveFeedback = () => {
    setSaveFeedback(null);
  };

  useEffect(() => {
    if (!isOpen) {
      initializedRef.current = false;
      setConfirmAction(null);
      setSaveFeedback(null);
      setIsSaving(false);
      return;
    }

    if (!settings || initializedRef.current) {
      return;
    }

    setOrganizations(settings.organizations ?? []);
    setPrSources(settings.prSources ?? []);
    setByokProviders(settings.byokProviders ?? []);
    setDefaultModel(normalizeDefaultModelId(settings.defaultModel));
    setDefaultDiffViewMode(settings.defaultDiffViewMode ?? 'inline');
    setMyDisplayName(settings.myDisplayName ?? '');
    setReviewWorktreeRootFolder(settings.reviewStorage?.folderPath ?? '');
    setDatabaseFolder(settings.database?.folderPath ?? '');
    setPurgeMessage('');
    setSaveFeedback(null);
    setActiveTab(initialTab);
    initializedRef.current = true;
  }, [initialTab, isOpen, settings]);

  if (!isOpen || !settings) {
    return null;
  }

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const result = await onSave({
        ...settings,
        organizations,
        prSources,
        database: {
          ...(settings.database ?? {}),
          folderPath: databaseFolder?.trim() ? databaseFolder.trim() : null
        },
        reviewQueue: {
          ...settings.reviewQueue,
          maxConcurrentReviews: 1
        },
        reviewStorage: {
          ...(settings.reviewStorage ?? {}),
          folderPath: reviewWorktreeRootFolder?.trim() ? reviewWorktreeRootFolder.trim() : null
        },
        defaultModel,
        defaultDiffViewMode,
        myDisplayName: myDisplayName?.trim() || null
      });

      if (result.status === 'success') {
        onClose();
        return;
      }

      setSaveFeedback({
        message: result.message,
        issues: result.issues
      });
      setActiveTab('ado');
    } catch {
      // App-level error presentation keeps the modal open and shows the actionable banner.
    } finally {
      setIsSaving(false);
    }
  };

  const clearPersisted = () => {
    setConfirmAction({
      title: LABELS.confirmDeleteAllTitle,
      message: LABELS.confirmDeleteAllMessage,
      action: () => { void onClearPersistedReviews(); }
    });
  };

  const clearPersistedForCompletedPullRequests = () => {
    setConfirmAction({
      title: LABELS.confirmDeleteCompletedTitle,
      message: LABELS.confirmDeleteCompletedMessage,
      action: () => { void onClearPersistedReviewsForCompletedPullRequests(); }
    });
  };

  const purgeOldData = (days: number) => {
    const label = days === 30 ? '1 month' : `${days} days`;
    setConfirmAction({
      title: LABELS.confirmPurgeTitle,
      message: confirmPurgeMessage(label),
      action: async () => {
        try {
          const result = await api.purgeOldData(days);
          setPurgeMessage(purgeResultMessage(result.reviewJobs, result.followUps));
        } catch {
          setPurgeMessage(LABELS.purgeFailed);
        }
      }
    });
  };

  const browseDatabaseFolder = async () => {
    try {
      const selected = await api.pickReviewStorageFolder();
      if (selected) {
        clearSaveFeedback();
        setDatabaseFolder(selected);
      }
    } catch {
      // non-blocking
    }
  };

  const browseReviewWorktreeRootFolder = async () => {
    try {
      const selected = await api.pickReviewStorageFolder();
      if (selected) {
        clearSaveFeedback();
        setReviewWorktreeRootFolder(selected);
      }
    } catch {
      // non-blocking
    }
  };

  const handleDeleteOrganization = (organizationId: string) => {
    const organization = organizations.find((item) => item.id === organizationId);
    if (!organization) {
      return;
    }

    const dependentSources = prSources.filter((source) => source.organizationId === organizationId);
    const hasDependencies = dependentSources.length > 0;

    setConfirmAction({
      title: hasDependencies ? LABELS.deleteOrganizationAndSourcesTitle : LABELS.deleteOrganizationTitle,
      message: hasDependencies
        ? buildDeleteOrganizationCascadeMessage(organization.name, dependentSources.map((source) => source.name))
        : buildDeleteOrganizationMessage(organization.name),
      confirmLabel: hasDependencies ? LABELS.deleteOrganizationAndSourcesConfirm : LABELS.confirmDelete,
      action: () => {
        clearSaveFeedback();
        setOrganizations((current) => current.filter((item) => item.id !== organizationId));
        if (hasDependencies) {
          setPrSources((current) => current.filter((source) => source.organizationId !== organizationId));
        }
      }
    });
  };

  const handleDeleteByokProvider = (providerId: string) => {
    const provider = byokProviders.find((item) => item.id === providerId);
    if (!provider) return;

    setConfirmAction({
      title: BYOK_DELETE_LABELS.title,
      message: buildDeleteByokProviderMessage(provider.label),
      confirmLabel: BYOK_DELETE_LABELS.confirm,
      action: async () => {
        clearSaveFeedback();
        try {
          const result = await api.deleteByokProvider(providerId);
          setByokProviders(result.settings.byokProviders ?? []);
        } catch (err: unknown) {
          console.error('[SettingsModal] Failed to delete BYOK provider:', err);
        }
      }
    });
  };

  return (
    <div className="modal-backdrop">
      <div className={`modal ${styles.settingsModal}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>{LABELS.heading}</h2>
        </div>
        <div className="modal-body">
          <div className={styles.tabs}>
            <button
              className={`${styles.tab}${activeTab === 'ado' ? ` ${styles.tabActive}` : ''}`}
              onClick={() => setActiveTab('ado')}
            >
              <i className="fa-solid fa-cloud" /> {LABELS.tabAdo}
            </button>
            <button
              className={`${styles.tab}${activeTab === 'byok' ? ` ${styles.tabActive}` : ''}`}
              onClick={() => setActiveTab('byok')}
            >
              <i className="fa-solid fa-server" /> {LABELS.tabByok}
            </button>
            <button
              className={`${styles.tab}${activeTab === 'preferences' ? ` ${styles.tabActive}` : ''}`}
              onClick={() => setActiveTab('preferences')}
            >
              <i className="fa-solid fa-sliders" /> {LABELS.tabPreferences}
            </button>
            <button
              className={`${styles.tab}${activeTab === 'data' ? ` ${styles.tabActive}` : ''}`}
              onClick={() => setActiveTab('data')}
            >
              <i className="fa-solid fa-database" /> {LABELS.tabData}
            </button>
          </div>

          {saveFeedback && (
            <div className={`${styles.connectionResult} ${styles.connectionErr}`}>
              <i className="fa-solid fa-circle-xmark" />
              <span>
                <strong>{LABELS.partialSaveTitle}</strong>{saveFeedback.message ? ` ${saveFeedback.message}` : ''}
              </span>
            </div>
          )}

          <div className={styles.tabContent}>
            {activeTab === 'ado' && (
              <AdoTab
                organizations={organizations}
                prSources={prSources}
                myDisplayName={myDisplayName}
                saveIssues={saveFeedback?.issues ?? []}
                onOrganizationsChange={(next) => {
                  clearSaveFeedback();
                  setOrganizations(next);
                }}
                onPrSourcesChange={(next) => {
                  clearSaveFeedback();
                  setPrSources(next);
                }}
                onDisplayNameChange={(value) => {
                  clearSaveFeedback();
                  setMyDisplayName(value);
                }}
                onRequestDeleteOrganization={handleDeleteOrganization}
              />
            )}

            {activeTab === 'byok' && (
              <ByokTab
                providers={byokProviders}
                saveIssues={saveFeedback?.issues ?? []}
                onProvidersChange={(next) => {
                  clearSaveFeedback();
                  setByokProviders(next);
                }}
                onRequestDeleteProvider={handleDeleteByokProvider}
              />
            )}

            {activeTab === 'preferences' && (
              <PreferencesTab
                defaultModel={defaultModel}
                defaultDiffViewMode={defaultDiffViewMode}
                reviewWorktreeRootFolder={reviewWorktreeRootFolder}
                onDefaultModelChange={(value) => {
                  clearSaveFeedback();
                  setDefaultModel(value);
                }}
                onDefaultDiffViewModeChange={(value) => {
                  clearSaveFeedback();
                  setDefaultDiffViewMode(value);
                }}
                onReviewWorktreeRootFolderChange={(value) => {
                  clearSaveFeedback();
                  setReviewWorktreeRootFolder(value);
                }}
                onBrowseReviewWorktreeRootFolder={browseReviewWorktreeRootFolder}
              />
            )}

            {activeTab === 'data' && (
              <DataTab
                databaseFolder={databaseFolder}
                purgeMessage={purgeMessage}
                onDatabaseFolderChange={(value) => {
                  clearSaveFeedback();
                  setDatabaseFolder(value);
                }}
                onBrowseFolder={browseDatabaseFolder}
                onPurgeOldData={purgeOldData}
                onClearPersisted={clearPersisted}
                onClearPersistedCompleted={clearPersistedForCompletedPullRequests}
              />
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={handleClose} disabled={isSaving}>{LABELS.cancel}</button>
          <button className="btn accent" onClick={handleSave} disabled={isSaving}>
            {isSaving ? LABELS.saving : LABELS.save}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmAction !== null}
        title={confirmAction?.title ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={confirmAction?.confirmLabel ?? LABELS.confirmDelete}
        onConfirm={() => {
          const action = confirmAction?.action;
          setConfirmAction(null);
          void action?.();
        }}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
