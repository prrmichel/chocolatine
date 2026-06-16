import { ReviewJob } from '@shared/types/models';
import CopyButton from '../CopyButton/CopyButton';
import ReviewSkillMarkersPanel from '../ReviewSkillMarkersPanel/ReviewSkillMarkersPanel';
import { LABELS, passLabel, passLatestLabel, sessionTitle } from './PromptPreviewModal.messages';
import styles from './PromptPreviewModal.module.css';

/** Simple mode: show a single prompt text */
interface SimplePromptPreview {
  mode: 'simple';
  title: string;
  content: string;
}

/** Accordion mode: show multi-pass review history from a ReviewJob */
interface AccordionPromptPreview {
  mode: 'accordion';
  title: string;
  job: ReviewJob;
}

export type PromptPreviewData = SimplePromptPreview | AccordionPromptPreview;

interface PromptPreviewModalProps {
  data: PromptPreviewData | null;
  onClose: () => void;
}

const usageBadge = (summary?: { totalTokens: number; modelUsed: string; durationMs?: number }): string | null => {
  if (!summary) {
    return null;
  }
  const parts = [`${summary.totalTokens.toLocaleString()} tokens`, summary.modelUsed];
  if (summary.durationMs != null) {
    parts.push(`${summary.durationMs.toLocaleString()}ms`);
  }
  return parts.join(' · ');
};

export default function PromptPreviewModal({ data, onClose }: PromptPreviewModalProps) {
  if (!data) return null;

  const job = data.mode === 'accordion' ? data.job : null;
  const hasSkillInfo = job && ((job.activeSkills?.length ?? 0) > 0 || (job.skillMarkerResults?.length ?? 0) > 0);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={`modal ${styles.promptPreviewModal}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header row between">
          <h2>{data.title}</h2>
          {data.mode === 'simple' && (
            <CopyButton text={data.content} title={LABELS.copyPrompt} />
          )}
          {data.mode === 'accordion' && (
            <button className="btn" onClick={onClose} title={LABELS.close} aria-label={LABELS.close}>
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          )}
        </div>
        <div className="modal-body">
          {hasSkillInfo && <ReviewSkillMarkersPanel job={job} />}
          {data.mode === 'simple' ? (
            <pre className={styles.promptPreviewContent}>{data.content || LABELS.noPromptContent}</pre>
          ) : (
            <AccordionBody job={data.job} />
          )}
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>{LABELS.close}</button>
        </div>
      </div>
    </div>
  );
}

function AccordionBody({ job }: { job: ReviewJob }) {
  const history = job.reviewHistory ?? [];
  const totalPasses = history.length + 1;

  const handleToggle = (e: React.SyntheticEvent<HTMLDetailsElement>) => {
    if (!(e.currentTarget as HTMLDetailsElement).open) return;
    const parent = (e.currentTarget as HTMLElement).parentElement;
    if (!parent) return;
    parent.querySelectorAll(':scope > details[open]').forEach((el) => {
      if (el !== e.currentTarget) (el as HTMLDetailsElement).open = false;
    });
  };

  return (
    <div className={styles.promptPreviewAccordion}>
      {history.map((entry, idx) => (
        <details key={idx} className={styles.promptPreviewDetails} onToggle={handleToggle}>
          <summary className={styles.promptPreviewSummary}>
            <div className={styles.promptPreviewSummaryMain}>
              <span>{passLabel(entry.attempt, totalPasses, entry.startedAt)}</span>
              {entry.isReReview && (
                <span className={styles.sessionBadge} title={sessionTitle(entry.sessionKey)}>
                  <i className="fa-solid fa-link" aria-hidden="true" /> {LABELS.reReviewSameSession}
                </span>
              )}
              {!entry.isReReview && (
                <span className={styles.sessionBadgeNew} title={LABELS.newSession}>
                  <i className="fa-solid fa-plus" aria-hidden="true" /> {LABELS.newSession}
                </span>
              )}
              {usageBadge(entry.attemptUsageSummary) && (
                <span className={styles.sessionBadgeNew} title={usageBadge(entry.attemptUsageSummary) ?? undefined}>
                  <i className="fa-solid fa-microchip" aria-hidden="true" /> {usageBadge(entry.attemptUsageSummary)}
                </span>
              )}
            </div>
            <div className={styles.promptPreviewSummaryActions}>
              <CopyButton
                text={entry.sentPrompt || entry.prompt}
                title={LABELS.copyThisPrompt}
                className="btn"
              />
              <i className={`fa-solid fa-chevron-down ${styles.promptPreviewChevron}`} aria-hidden="true" />
            </div>
          </summary>
          <div className={styles.promptPreviewDetailsBody}>
            <pre className={styles.promptPreviewContent}>
              {entry.sentPrompt || entry.prompt || LABELS.noPromptContent}
            </pre>
          </div>
        </details>
      ))}
      <details open className={styles.promptPreviewDetails} onToggle={handleToggle}>
        <summary className={styles.promptPreviewSummary}>
          <div className={styles.promptPreviewSummaryMain}>
            <span>{passLatestLabel(totalPasses, job.startedAt)}</span>
            {job.isReReview && (
              <span className={styles.sessionBadge} title={sessionTitle(job.sessionKey)}>
                <i className="fa-solid fa-link" aria-hidden="true" /> {LABELS.reReviewSameSession}
              </span>
            )}
            {!job.isReReview && job.sessionKey && (
              <span className={styles.sessionBadgeNew} title={LABELS.newSession}>
                <i className="fa-solid fa-plus" aria-hidden="true" /> {LABELS.newSession}
              </span>
            )}
            {usageBadge(job.attemptUsageSummary) && (
              <span className={styles.sessionBadgeNew} title={usageBadge(job.attemptUsageSummary) ?? undefined}>
                <i className="fa-solid fa-microchip" aria-hidden="true" /> {usageBadge(job.attemptUsageSummary)}
              </span>
            )}
          </div>
          <div className={styles.promptPreviewSummaryActions}>
            <CopyButton
              text={job.lastSentPrompt || job.prompt || ''}
              title={LABELS.copyThisPrompt}
              className="btn"
            />
            <i className={`fa-solid fa-chevron-down ${styles.promptPreviewChevron}`} aria-hidden="true" />
          </div>
        </summary>
        <div className={styles.promptPreviewDetailsBody}>
          <pre className={styles.promptPreviewContent}>
            {job.lastSentPrompt || job.prompt || LABELS.noPromptContent}
          </pre>
        </div>
      </details>
    </div>
  );
}
