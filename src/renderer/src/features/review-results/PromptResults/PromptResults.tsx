import { useState, useRef, useEffect, useMemo } from 'react';
import { getModelDisplayName } from '@shared/constants/modelOptions';
import { ReviewJob } from '@shared/types/models';
import { getTaskType } from '@renderer/utils/severity';
import { copyToClipboard } from '@renderer/utils/clipboard';
import ReviewSkillMarkersPanel from '@renderer/features/shared/ReviewSkillMarkersPanel/ReviewSkillMarkersPanel';
import { LABELS, charsLabel, tabLabelWithCount, tasksHeader } from './PromptResults.messages';
import styles from './PromptResults.module.css';

interface PromptResultsProps {
  jobs: ReviewJob[];
}

const STATUS_ICON: Record<string, string> = {
  Running: '⏳',
  Completed: '✅',
  Failed: '❌',
  Canceled: '⊘',
  Queued: '🕐',
};

function getLogLineClass(line: string): string {
  if (line.startsWith('[Thinking]') || line.startsWith('[Reasoning')) return styles.logLineReasoning;
  if (line.startsWith('[Intent]')) return styles.logLineIntent;
  if (line.startsWith('[Tool ')) return styles.logLineTool;
  if (line.startsWith('[Skill]') || line.startsWith('[Skills Loaded]')) return styles.logLineSkill;
  if (line.startsWith('[Turn ')) return styles.logLineTurn;
  if (line.startsWith('[Error]') || line.startsWith('[Abort]')) return styles.logLineError;
  if (line.startsWith('[Warning]')) return styles.logLineWarning;
  if (line.startsWith('[Info]') || line.startsWith('[Session]')) return styles.logLineInfo;
  if (line.startsWith('[SubAgent]')) return styles.logLineSubagent;
  if (line.startsWith('[Usage]') || line.startsWith('[Context Window]')) return styles.logLineUsage;
  if (line.startsWith('[Permission]')) return styles.logLinePermission;
  if (line.startsWith('[Compaction]')) return styles.logLineCompaction;
  if (line.startsWith('[Message')) return styles.logLineMessage;
  if (line.startsWith('[Response')) return styles.logLineResponse;
  if (line.startsWith('[User ')) return styles.logLineUser;
  if (line.startsWith('[System]') || line.startsWith('[Command]')) return styles.logLineSystem;
  if (line.startsWith('[External Tool]') || line.startsWith('[MCP]')) return styles.logLineTool;
  if (line.startsWith('[Plan')) return styles.logLineIntent;
  if (line.startsWith('[Model]') || line.startsWith('[Context]')) return styles.logLineInfo;
  if (line.startsWith('[Task Complete]')) return styles.logLineSkill;
  return '';
}

function DebugLogViewer({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines.length]);

  if (lines.length === 0) return <div className={styles.emptyLog}>{LABELS.noDebugLogsYet}</div>;

  return (
    <div className={styles.logViewer}>
      {lines.map((l, i) => (
        <div key={i} className={`${styles.logLine} ${getLogLineClass(l)}`}>{l}</div>
      ))}
      <div ref={endRef} />
    </div>
  );
}

/** Auto-scrolling viewer for the streaming response text. */
function StreamingResponseViewer({ text }: { text: string }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [text]);

  return (
    <div className={styles.responseViewer}>
      <pre className={styles.responsePre}>{text}</pre>
      <div ref={endRef} />
    </div>
  );
}

function TaskDetail({ job }: { job: ReviewJob }) {
  const isRunning = job.status === 'Running';
  const [activeTab, setActiveTab] = useState<'logs' | 'prompt' | 'response'>('logs');
  const skillNames = Array.from(new Set([...(job.activeSkills ?? []), ...(job.skillMarkerResults ?? []).map((marker) => marker.skillName)]));

  return (
    <div className={styles.detail}>
      {/* Header */}
      <div className={styles.detailHeader}>
        <div className="run-title">{job.pullRequest.title}</div>
        <div className="run-meta">
          {getTaskType(job)} · {getModelDisplayName(job.modelName)}
          {job.batchLabel ? ` · ${job.batchLabel}` : ''}
          {job.sessionKey ? ` · session: ${job.sessionKey}` : ''}
          {job.isReReview ? ' · re-review' : ''}
          {' · '}{job.status}
          {isRunning && (
            <span className={styles.streamingIndicator}>
              <span className={styles.streamingDot} /> streaming
            </span>
          )}
        </div>
        {isRunning && job.progressPercent != null && (
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${job.progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Skills badges */}
      {skillNames.length > 0 && (
        <div className={styles.skillsBadges}>
          {skillNames.map((s) => {
            const marker = job.skillMarkerResults?.find((m) => m.skillName === s);
            const cls = marker ? (marker.found ? styles.skillFound : styles.skillMissing) : styles.skillPending;
            return <span key={s} className={`${styles.skillBadge} ${cls}`}>{s}{marker ? (marker.found ? ' ✓' : ' ✗') : ''}</span>;
          })}
        </div>
      )}

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${activeTab === 'logs' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          {tabLabelWithCount(LABELS.debugLogs, job.debugLogs?.length ?? 0)}
          {isRunning && (job.debugLogs?.length ?? 0) > 0 && (
            <span className={styles.liveLabel}>{LABELS.live}</span>
          )}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'prompt' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('prompt')}
          disabled={!job.lastSentPrompt}
        >
          {job.lastSentPrompt ? charsLabel(LABELS.promptSent, job.lastSentPrompt.length) : LABELS.promptSent}
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'response' ? styles.tabActive : ''}`}
          onClick={() => setActiveTab('response')}
          disabled={!job.reviewResponse}
        >
          {job.reviewResponse ? charsLabel(LABELS.response, job.reviewResponse.length) : LABELS.response}
          {isRunning && job.reviewResponse != null && (
            <span className={styles.liveLabel}>{LABELS.live}</span>
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className={styles.tabContent}>
        {activeTab === 'logs' && (
          <DebugLogViewer lines={job.debugLogs ?? []} />
        )}

        {activeTab === 'prompt' && job.lastSentPrompt && (
          <div className={styles.detailSection}>
            <div className={styles.sectionHeader}>
              <span>Prompt sent ({job.lastSentPrompt.length.toLocaleString()} chars)</span>
              <button className={`btn ${styles.miniBtn}`} onClick={() => void copyToClipboard(job.lastSentPrompt!)}>Copy</button>
            </div>
            <pre className={styles.promptPre}>{job.lastSentPrompt}</pre>
          </div>
        )}

        {activeTab === 'response' && (
          <>
            {isRunning && job.reviewResponse != null && (
              <div className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <span>{charsLabel(LABELS.streaming, job.reviewResponse.length)}</span>
                  {job.reviewResponse.length > 0 && (
                    <button className={`btn ${styles.miniBtn}`} onClick={() => void copyToClipboard(job.reviewResponse!)}>{LABELS.copy}</button>
                  )}
                </div>
                {skillNames.length > 0 && (
                  <ReviewSkillMarkersPanel job={job} />
                )}
                <StreamingResponseViewer text={job.reviewResponse} />
              </div>
            )}
            {!isRunning && job.reviewResponse && (
              <div className={styles.detailSection}>
                <div className={styles.sectionHeader}>
                  <span>{charsLabel(LABELS.response, job.reviewResponse.length)}</span>
                  <button className={`btn ${styles.miniBtn}`} onClick={() => void copyToClipboard(job.reviewResponse!)}>{LABELS.copy}</button>
                </div>
                {skillNames.length > 0 && (
                  <ReviewSkillMarkersPanel job={job} />
                )}
                <pre className={styles.promptPre}>{job.reviewResponse}</pre>
              </div>
            )}
            {!job.reviewResponse && (
              <div className={styles.emptyLog}>{LABELS.noResponseYet}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PromptResults({ jobs }: PromptResultsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Auto-select the latest running job, or fallback to prior selection
  const effectiveId = useMemo(() => {
    const running = jobs.find((j) => j.status === 'Running');
    if (running) return running.id;
    if (selectedId && jobs.some((j) => j.id === selectedId)) return selectedId;
    return jobs[0]?.id ?? null;
  }, [jobs, selectedId]);

  const selectedJob = useMemo(
    () => jobs.find((j) => j.id === effectiveId) ?? null,
    [jobs, effectiveId]
  );

  if (jobs.length === 0) {
    return (
      <section className="panel">
        <div className="panel-header">{LABELS.panelHeader}</div>
        <div className="empty">{LABELS.noResults}</div>
      </section>
    );
  }

  return (
    <section className={styles.container}>
      {/* Left column: task list */}
      <div className={styles.taskList}>
        <div className={styles.taskListHeader}>{tasksHeader(jobs.length)}</div>
        {jobs.map((job) => (
          <button
            key={job.id}
            className={`${styles.taskItem} ${job.id === effectiveId ? styles.taskItemSelected : ''}`}
            onClick={() => setSelectedId(job.id)}
          >
            <span className={styles.taskIcon}>{STATUS_ICON[job.status] ?? '●'}</span>
            <div className={styles.taskInfo}>
              <div className={styles.taskTitle}>{job.pullRequest.title}</div>
              <div className={styles.taskMeta}>
                {getTaskType(job)} · {getModelDisplayName(job.modelName)}
                {job.batchLabel ? ` · ${job.batchLabel}` : ''}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Right column: detail of selected task */}
      <div className={styles.detailPane}>
        {selectedJob ? (
          <TaskDetail job={selectedJob} />
        ) : (
          <div className="empty">{LABELS.selectTaskToViewLogs}</div>
        )}
      </div>
    </section>
  );
}
