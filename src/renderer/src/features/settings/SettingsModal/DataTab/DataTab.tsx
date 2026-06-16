import { LABELS } from '../SettingsModal.messages';
import styles from '../SettingsModal.module.css';

interface DataTabProps {
  databaseFolder: string;
  purgeMessage: string;
  onDatabaseFolderChange: (value: string) => void;
  onBrowseFolder: () => void;
  onPurgeOldData: (days: number) => void;
  onClearPersisted: () => void;
  onClearPersistedCompleted: () => void;
}

export default function DataTab({
  databaseFolder,
  purgeMessage,
  onDatabaseFolderChange,
  onBrowseFolder,
  onPurgeOldData,
  onClearPersisted,
  onClearPersistedCompleted
}: DataTabProps) {
  return (
    <>
      <p className="helper">{LABELS.dataHelper}</p>
      <label className="form-label">
        {LABELS.dbFolder}
        <div className={styles.folderRow}>
          <input
            className="input"
            type="text"
            value={databaseFolder}
            placeholder={LABELS.dbFolderPlaceholder}
            onChange={(e) => onDatabaseFolderChange(e.target.value)}
          />
          <button className="btn" type="button" onClick={onBrowseFolder}>{LABELS.browse}</button>
        </div>
      </label>
      <p className="helper">{LABELS.dbFolderHelper}</p>
      <div className="row between">
        <span className="muted">{LABELS.purgeByAge}</span>
        <div className="row">
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => onPurgeOldData(30)}
            title={LABELS.purge1MonthTitle}
          >
            <i className="fa-solid fa-calendar-minus" /> {LABELS.purge1Month}
          </button>
          <button
            className="btn btn-danger"
            type="button"
            onClick={() => onPurgeOldData(90)}
            title={LABELS.purge3MonthsTitle}
          >
            <i className="fa-solid fa-calendar-minus" /> {LABELS.purge3Months}
          </button>
        </div>
      </div>
      {purgeMessage && <p className="helper">{purgeMessage}</p>}
      <div className="row between">
        <span className="muted">{LABELS.bulkDelete}</span>
        <div className="row">
          <button
            className="btn btn-danger"
            type="button"
            onClick={onClearPersistedCompleted}
            title={LABELS.deleteCompletedPRTitle}
          >
            {LABELS.deleteCompletedPR}
          </button>
          <button className="btn btn-danger" type="button" onClick={onClearPersisted}>
            {LABELS.deleteAllData}
          </button>
        </div>
      </div>
    </>
  );
}
