import { useMemo, useState } from 'react';
import { PullRequestThread } from '@shared/types/models';
import { AdoThreadsSection } from '../ChangesTab/DiffViewer/DiffViewer';
import styles from './UserCommentsTab.module.css';

interface UserCommentsTabProps {
  threads: PullRequestThread[];
  isThreadRead: (threadId: number) => boolean;
  onToggleThreadRead: (threadId: number) => void;
  onMarkThreadsRead: (threadIds: number[]) => void;
  onMarkThreadsUnread: (threadIds: number[]) => void;
  onNavigateToLine: (filePath: string, line?: number) => void;
}

const getThreadLatestDate = (thread: PullRequestThread) => {
  return thread.comments.reduce((latest, comment) => {
    const time = new Date(comment.publishedDate).getTime();
    return Number.isFinite(time) ? Math.max(latest, time) : latest;
  }, 0);
};

const stripHtml = (value: string) => value
  .replace(/<[^>]*>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildThreadSearchText = (thread: PullRequestThread) => {
  const commentText = thread.comments.map((comment) => {
    return `${comment.author} ${stripHtml(comment.content ?? '')}`;
  }).join(' ');
  return `${thread.filePath ?? ''} ${thread.line ?? ''} ${thread.status ?? ''} ${commentText}`.toLowerCase();
};

export default function UserCommentsTab({
  threads,
  isThreadRead,
  onToggleThreadRead,
  onMarkThreadsRead,
  onMarkThreadsUnread,
  onNavigateToLine
}: UserCommentsTabProps) {
  const [filterText, setFilterText] = useState('');

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => getThreadLatestDate(b) - getThreadLatestDate(a));
  }, [threads]);

  const filteredThreads = useMemo(() => {
    const query = filterText.trim().toLowerCase();
    if (!query) {
      return sortedThreads;
    }
    return sortedThreads.filter((thread) => buildThreadSearchText(thread).includes(query));
  }, [sortedThreads, filterText]);

  const visibleThreadIds = useMemo(() => filteredThreads.map((thread) => thread.id), [filteredThreads]);

  return (
    <div className={styles.userCommentsTab}>
      <div className={styles.userCommentsFilter}>
        <input
          type="text"
          placeholder="Search user comments"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
        />
        <button
          type="button"
          className={styles.filterAction}
          onClick={() => onMarkThreadsRead(visibleThreadIds)}
          disabled={visibleThreadIds.length === 0}
          title="Mark visible threads as read"
          aria-label="Mark visible threads as read"
        >
          <i className="fa-solid fa-envelope-open" aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.filterAction}
          onClick={() => onMarkThreadsUnread(visibleThreadIds)}
          disabled={visibleThreadIds.length === 0}
          title="Mark visible threads as unread"
          aria-label="Mark visible threads as unread"
        >
          <i className="fa-solid fa-envelope" aria-hidden="true" />
        </button>
      </div>
      {filteredThreads.length === 0 ? (
        <div className="empty">No user comments found.</div>
      ) : (
        <AdoThreadsSection
          title="User comments"
          threads={filteredThreads}
          isThreadRead={isThreadRead}
          onToggleThreadRead={onToggleThreadRead}
          showFilePath
          onNavigateToLine={onNavigateToLine}
        />
      )}
    </div>
  );
}
