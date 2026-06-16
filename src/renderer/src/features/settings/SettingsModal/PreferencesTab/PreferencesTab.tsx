import { useMemo } from 'react';
import { buildModelOptions } from '@shared/constants/modelOptions';
import { useSettingsStore } from '@renderer/features/settings/state/useSettingsStore';
import ModelSelect from '@renderer/features/shared/ModelSelect/ModelSelect';
import { LABELS } from '../SettingsModal.messages';
import styles from '../SettingsModal.module.css';

interface PreferencesTabProps {
  defaultModel: string;
  defaultDiffViewMode: 'inline' | 'side';
  reviewWorktreeRootFolder: string;
  onDefaultModelChange: (value: string) => void;
  onDefaultDiffViewModeChange: (value: 'inline' | 'side') => void;
  onReviewWorktreeRootFolderChange: (value: string) => void;
  onBrowseReviewWorktreeRootFolder: () => void;
}

export default function PreferencesTab({
  defaultModel,
  defaultDiffViewMode,
  reviewWorktreeRootFolder,
  onDefaultModelChange,
  onDefaultDiffViewModeChange,
  onReviewWorktreeRootFolderChange,
  onBrowseReviewWorktreeRootFolder
}: PreferencesTabProps) {
  const { modelsVersion } = useSettingsStore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const modelOpts = useMemo(() => buildModelOptions(), [modelsVersion]);

  return (
    <div className={styles.prefSections}>
      {/* ── Review section ── */}
      <section className={styles.prefSection}>
        <h3 className={styles.prefSectionTitle}>
          <i className="fa-solid fa-robot" aria-hidden="true" />
          Review
        </h3>
        <div className={`${styles.prefRow} ${styles.prefRowModel}`}>
          <label className={`${styles.prefLabel} ${styles.prefLabelCompact}`} htmlFor="default-model">
            <span>{LABELS.defaultModel}</span>
            <span className={styles.prefHint}>Model used when starting a new review</span>
          </label>
          <div className={styles.prefModelSelectWrap}>
            <ModelSelect
              value={defaultModel}
              options={modelOpts}
              onChange={onDefaultModelChange}
              className={`model-select ${styles.prefSelect} ${styles.prefModelSelect}`}
              unavailableMessage={LABELS.modelCatalogUnavailable}
              keyPrefix="settings-preferences"
            />
          </div>
        </div>
      </section>

      {/* ── Display section ── */}
      <section className={styles.prefSection}>
        <h3 className={styles.prefSectionTitle}>
          <i className="fa-solid fa-display" aria-hidden="true" />
          Display
        </h3>
        <div className={styles.prefRow}>
          <label className={styles.prefLabel} htmlFor="diff-view-mode">
            <span>{LABELS.defaultDiffViewMode}</span>
            <span className={styles.prefHint}>How the diff is shown by default</span>
          </label>
          <div className={styles.prefSegmented} role="group" aria-label={LABELS.defaultDiffViewMode}>
            <button
              type="button"
              className={`${styles.prefSegBtn} ${defaultDiffViewMode === 'inline' ? styles.prefSegBtnActive : ''}`}
              onClick={() => onDefaultDiffViewModeChange('inline')}
            >
              <i className="fa-solid fa-bars" aria-hidden="true" />
              {LABELS.diffInline}
            </button>
            <button
              type="button"
              className={`${styles.prefSegBtn} ${defaultDiffViewMode === 'side' ? styles.prefSegBtnActive : ''}`}
              onClick={() => onDefaultDiffViewModeChange('side')}
            >
              <i className="fa-solid fa-table-columns" aria-hidden="true" />
              {LABELS.diffSideBySide}
            </button>
          </div>
        </div>
        <div className={styles.prefRow}>
          <label className={styles.prefLabel} htmlFor="review-worktree-root-folder">
            <span>{LABELS.reviewWorktreeRootFolder}</span>
            <span className={styles.prefHint}>{LABELS.reviewWorktreeRootFolderHint}</span>
          </label>
          <div className={`${styles.folderRow} ${styles.prefFolderRow}`}>
            <input
              id="review-worktree-root-folder"
              className="input"
              type="text"
              value={reviewWorktreeRootFolder}
              placeholder={LABELS.reviewWorktreeRootFolderPlaceholder}
              onChange={(event) => onReviewWorktreeRootFolderChange(event.target.value)}
            />
            <button className="btn" type="button" onClick={onBrowseReviewWorktreeRootFolder}>{LABELS.browse}</button>
          </div>
        </div>
      </section>
    </div>
  );
}
