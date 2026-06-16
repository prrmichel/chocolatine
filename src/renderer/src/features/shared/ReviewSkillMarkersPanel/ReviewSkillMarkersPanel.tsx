import { ReviewJob, SkillMarkerResult } from '@shared/types/models';
import { LABELS, markerStatusTitle, pendingMarkerTitle, skillsHeader } from './ReviewSkillMarkersPanel.messages';
import styles from './ReviewSkillMarkersPanel.module.css';

interface ReviewSkillMarkersPanelProps {
  job: Pick<ReviewJob, 'activeSkills' | 'skillMarkerResults'>;
  className?: string;
}

export default function ReviewSkillMarkersPanel({ job, className }: ReviewSkillMarkersPanelProps) {
  const skills = job.activeSkills ?? [];
  const markers = job.skillMarkerResults ?? [];
  const markerMap = new Map<string, SkillMarkerResult>();

  for (const marker of markers) {
    markerMap.set(marker.skillName, marker);
  }

  const allSkillNames = Array.from(new Set([...markers.map((marker) => marker.skillName), ...skills]));
  if (allSkillNames.length === 0) {
    return null;
  }

  return (
    <div className={[styles.skillMarkersPanel, className].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
        <span>{skillsHeader(allSkillNames.length)}</span>
      </div>
      <div className={styles.list}>
        {allSkillNames.map((name) => {
          const marker = markerMap.get(name);
          const isPending = !marker;
          const statusClass = isPending
            ? styles.statusPending
            : marker.found
              ? styles.statusFound
              : styles.statusMissing;
          const statusTitle = isPending
            ? pendingMarkerTitle
            : markerStatusTitle(marker.found, marker.marker);
          const statusLabel = isPending
            ? LABELS.pending
            : marker.found
              ? LABELS.applied
              : LABELS.notApplied;
          const iconClass = isPending
            ? 'fa-clock'
            : marker.found
              ? 'fa-circle-check'
              : 'fa-circle-xmark';

          return (
            <div key={name} className={styles.item}>
              <span className={styles.name}>{name}</span>
              <span className={`${styles.statusBadge} ${statusClass}`} title={statusTitle}>
                <i className={`fa-solid ${iconClass}`} aria-hidden="true" />
                {statusLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}