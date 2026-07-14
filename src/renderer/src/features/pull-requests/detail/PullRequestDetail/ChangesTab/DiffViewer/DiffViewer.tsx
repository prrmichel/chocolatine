import hljs from 'highlight.js/lib/core';
import { memo, useMemo, useState } from 'react';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import scss from 'highlight.js/lib/languages/scss';
import less from 'highlight.js/lib/languages/less';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import markdown from 'highlight.js/lib/languages/markdown';
import sql from 'highlight.js/lib/languages/sql';
import python from 'highlight.js/lib/languages/python';
import bash from 'highlight.js/lib/languages/bash';
import powershell from 'highlight.js/lib/languages/powershell';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import java from 'highlight.js/lib/languages/java';
import kotlin from 'highlight.js/lib/languages/kotlin';
import go from 'highlight.js/lib/languages/go';
import rust from 'highlight.js/lib/languages/rust';
import ruby from 'highlight.js/lib/languages/ruby';
import php from 'highlight.js/lib/languages/php';
import ini from 'highlight.js/lib/languages/ini';
import 'highlight.js/styles/github-dark-dimmed.css';
import { PullRequestThread } from '@shared/types/models';
import { getSeverityClass } from '@renderer/utils/severity';
import { copyToClipboard } from '@renderer/utils/clipboard';
import CommentMarkdown from '@renderer/features/shared/CommentMarkdown/CommentMarkdown';
import CopyButton from '@renderer/features/shared/CopyButton/CopyButton';
import { buildAdoCommentDraft, formatSentTimestamp, normalizePath } from '../../PullRequestDetail.helpers';
import { LABELS } from '../ChangesTab.messages';
import type { ReviewCommentEntry } from '../ChangesTab.types';
import { getLanguageFromPath } from '@renderer/utils/fileIcons';
import './DiffViewer.css';

// Register only the languages we need (tree-shaking)
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);
hljs.registerLanguage('scss', scss);
hljs.registerLanguage('less', less);
hljs.registerLanguage('json', json);
hljs.registerLanguage('yaml', yaml);
hljs.registerLanguage('markdown', markdown);
hljs.registerLanguage('sql', sql);
hljs.registerLanguage('python', python);
hljs.registerLanguage('bash', bash);
hljs.registerLanguage('powershell', powershell);
hljs.registerLanguage('cpp', cpp);
hljs.registerLanguage('c', cpp); // reuse cpp grammar for C
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('java', java);
hljs.registerLanguage('kotlin', kotlin);
hljs.registerLanguage('go', go);
hljs.registerLanguage('rust', rust);
hljs.registerLanguage('ruby', ruby);
hljs.registerLanguage('php', php);
hljs.registerLanguage('ini', ini);

interface DiffViewerProps {
  diffText: string;
  filePath?: string;
  viewMode?: 'inline' | 'side';
  lineComments?: Map<number, ReviewCommentEntry[]>;
  onGoToReview?: () => void;
  isCommentRead?: (commentKey: string) => boolean;
  onToggleCommentRead?: (commentKey: string) => void;
  isCommentFavorite?: (commentKey: string) => boolean;
  onToggleCommentFavorite?: (commentKey: string) => void;
  onOpenFollowUp?: (runId: string) => void;
  onAskComment?: (text: string) => void;
  onSendToAdo?: (entry: ReviewCommentEntry) => void;
  getCommentSentAt?: (commentKey: string) => string | null;
  lineThreads?: Map<number, PullRequestThread[]>;
  isThreadRead?: (threadId: number) => boolean;
  onToggleThreadRead?: (threadId: number) => void;
  onToggleThreadResolved?: (thread: PullRequestThread) => Promise<void>;
  isThreadStatusUpdating?: (threadId: number) => boolean;
}

const highlightCache = new Map<string, string>();
const MAX_HIGHLIGHT_CACHE_ENTRIES = 5000;

/** Highlight a single line of code. Returns safe HTML from hljs. */
const highlightCode = (code: string, language: string): string => {
  const cacheKey = `${language}\u0000${code}`;
  const cached = highlightCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let highlighted: string;
  if (language === 'plaintext' || !code.trim()) {
    highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  } else {
    try {
      highlighted = hljs.highlight(code, { language, ignoreIllegals: true }).value;
    } catch {
      highlighted = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }

  if (highlightCache.size >= MAX_HIGHLIGHT_CACHE_ENTRIES) {
    highlightCache.clear();
  }
  highlightCache.set(cacheKey, highlighted);

  return highlighted;
};

/** Maximum diff lines rendered before truncation prompt. */
const MAX_INITIAL_LINES = 3000;

export default memo(function DiffViewer({
  diffText,
  filePath,
  viewMode = 'inline',
  lineComments,
  onGoToReview,
  isCommentRead,
  onToggleCommentRead,
  isCommentFavorite,
  onToggleCommentFavorite,
  onOpenFollowUp,
  onAskComment,
  onSendToAdo,
  getCommentSentAt,
  lineThreads,
  isThreadRead,
  onToggleThreadRead,
  onToggleThreadResolved,
  isThreadStatusUpdating
}: DiffViewerProps) {
  const [showAll, setShowAll] = useState(false);
  const language = filePath ? getLanguageFromPath(filePath) : undefined;
  const diffLines = useMemo(() => diffText.split('\n'), [diffText]);
  const lineCount = diffLines.length;
  const isTruncated = !showAll && lineCount > MAX_INITIAL_LINES;
  const displayText = useMemo(() => {
    if (!isTruncated) {
      return diffText;
    }

    return diffLines.slice(0, MAX_INITIAL_LINES).join('\n');
  }, [diffLines, diffText, isTruncated]);

  if (viewMode === 'side') {
    return (
      <>
        <div className="diff-side-grid">
          {renderSideBySideDiffLines(displayText, language, lineComments, onGoToReview, isCommentRead, onToggleCommentRead, isCommentFavorite, onToggleCommentFavorite, onOpenFollowUp, onAskComment, onSendToAdo, getCommentSentAt, lineThreads, isThreadRead, onToggleThreadRead, onToggleThreadResolved, isThreadStatusUpdating, filePath)}
        </div>
        {isTruncated && (
          <button type="button" className="diff-show-all-btn" onClick={() => setShowAll(true)}>
            Show all {lineCount.toLocaleString()} lines ({(lineCount - MAX_INITIAL_LINES).toLocaleString()} more)
          </button>
        )}
      </>
    );
  }
  return (
    <>
      <pre className="diff-pre">{renderDiffLines(displayText, language, lineComments, onGoToReview, isCommentRead, onToggleCommentRead, isCommentFavorite, onToggleCommentFavorite, onOpenFollowUp, onAskComment, onSendToAdo, getCommentSentAt, lineThreads, isThreadRead, onToggleThreadRead, onToggleThreadResolved, isThreadStatusUpdating, filePath)}</pre>
      {isTruncated && (
        <button type="button" className="diff-show-all-btn" onClick={() => setShowAll(true)}>
          Show all {lineCount.toLocaleString()} lines ({(lineCount - MAX_INITIAL_LINES).toLocaleString()} more)
        </button>
      )}
    </>
  );
});

interface AdoThreadsSectionProps {
  title: string;
  threads: PullRequestThread[];
  isThreadRead?: (threadId: number) => boolean;
  onToggleThreadRead?: (threadId: number) => void;
  onToggleThreadResolved?: (thread: PullRequestThread) => Promise<void>;
  isThreadStatusUpdating?: (threadId: number) => boolean;
  showFilePath?: boolean;
  onNavigateToLine?: (filePath: string, line?: number) => void;
  onAskComment?: (text: string) => void;
}

export function AdoThreadsSection({
  title,
  threads,
  isThreadRead,
  onToggleThreadRead,
  onToggleThreadResolved,
  isThreadStatusUpdating,
  showFilePath,
  onNavigateToLine,
  onAskComment
}: AdoThreadsSectionProps) {
  if (threads.length === 0) return null;
  return (
    <div className="ado-general-threads">
      <h4 className="ado-general-threads-title">
        <i className="fa-solid fa-comments" aria-hidden="true" /> {title} ({threads.length})
      </h4>
      <div className="ado-general-thread-list">
        {threads.map((thread) => renderInlineThread(
          thread,
          isThreadRead,
          onToggleThreadRead,
          onAskComment,
          showFilePath,
          onNavigateToLine,
          onToggleThreadResolved,
          isThreadStatusUpdating
        ))}
      </div>
    </div>
  );
}

// ── Private helpers ──

/** Post-process ADO thread comment HTML to render markdown-like code blocks ADO left unconverted. */
const processAdoContent = (html: string): string => {
  if (!html) return '';
  // Convert triple-backtick code blocks to <pre><code>
  let result = html.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const trimmed = code.trim();
    const escaped = trimmed
      .replace(/&(?![a-zA-Z]+;|#\d+;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return `<pre><code${lang ? ` class="language-${lang}"` : ''}>${escaped}</code></pre>`;
  });
  // Convert inline `code` to <code> (only outside existing tags)
  result = result.replace(/`([^`\n<>]+)`/g, (_, code) =>
    `<code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>`
  );
  return result;
};

const parseHunkHeader= (line: string) => {
  const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
  if (!match) return null;
  return { oldStart: Number(match[1]), newStart: Number(match[3]) };
};

const copyText = async (text: string) => {
  await copyToClipboard(text);
};

const renderDiffLines = (
  diffText: string,
  language: string | undefined,
  lineComments?: Map<number, ReviewCommentEntry[]>,
  onGoToReview?: () => void,
  isCommentRead?: (commentKey: string) => boolean,
  onToggleCommentRead?: (commentKey: string) => void,
  isCommentFavorite?: (commentKey: string) => boolean,
  onToggleCommentFavorite?: (commentKey: string) => void,
  onOpenFollowUp?: (runId: string) => void,
  onAskComment?: (text: string) => void,
  onSendToAdo?: (entry: ReviewCommentEntry) => void,
  getCommentSentAt?: (commentKey: string) => string | null,
  lineThreads?: Map<number, PullRequestThread[]>,
  isThreadRead?: (threadId: number) => boolean,
  onToggleThreadRead?: (threadId: number) => void,
  onToggleThreadResolved?: (thread: PullRequestThread) => Promise<void>,
  isThreadStatusUpdating?: (threadId: number) => boolean,
  filePath?: string
) => {
  const lines = diffText.split('\n');
  let newLine = 0;

  return lines.map((line, index) => {
    const hunk = line.startsWith('@@') ? parseHunkHeader(line) : null;
    if (hunk) {
      newLine = hunk.newStart;
      return (
        <span key={`${index}-hunk`} className="diff-line hunk">
          <span className="diff-lineno" />
          <span className="diff-content">{line}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    if (line.startsWith('+++') || line.startsWith('---')) {
      return (
        <span key={`${index}-file`} className="diff-line file">
          <span className="diff-lineno" />
          <span className="diff-content">{line}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    if (line.startsWith('\\ No newline at end of file')) {
      return (
        <span key={`${index}-eof`} className="diff-line meta">
          <span className="diff-lineno" />
          <span className="diff-content">{line}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    // Other meta lines (diff --git, index, Binary files, etc.)
    if (/^(diff |index |Binary )/.test(line)) {
      return (
        <span key={`${index}-meta`} className="diff-line meta">
          <span className="diff-lineno" />
          <span className="diff-content">{line}</span>
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      );
    }

    const isAdded = line.startsWith('+') && !line.startsWith('+++');
    const isRemoved = line.startsWith('-') && !line.startsWith('---');
    const lineClass = isAdded ? 'diff-line added' : isRemoved ? 'diff-line removed' : 'diff-line';
    const currentNewLine = isRemoved ? null : newLine;
    const newNumber = isRemoved ? '' : String(newLine || '');
    const commentsHere = currentNewLine ? lineComments?.get(currentNewLine) : undefined;
    const hasComments = commentsHere && commentsHere.length > 0;
    const threadsHere = currentNewLine ? lineThreads?.get(currentNewLine) : undefined;
    const hasThreads = threadsHere && threadsHere.length > 0;

    if (!isRemoved) newLine += 1;

    if (hasComments || hasThreads) {
      return [
        <span
          key={`${index}`}
          className={`${lineClass} has-comment`}
          data-line-new={currentNewLine || undefined}
        >
          <button
            type="button"
            className="diff-comment-marker"
            title="Has review comment — click to expand"
            onClick={(e) => {
              e.stopPropagation();
              const lineSpan = (e.currentTarget as HTMLElement).closest('.has-comment');
              let next = lineSpan?.nextSibling as Node | null;
              while (next && (next.nodeType !== 1 || !(next as Element).classList.contains('diff-inline-comments'))) {
                next = next.nextSibling;
              }
              if (next) {
                const items = (next as Element).querySelectorAll<HTMLDetailsElement>('details.diff-inline-comment');
                const anyOpen = Array.from(items).some(d => d.open);
                items.forEach(d => { d.open = !anyOpen; });
              }
            }}
          ><i className="fa-solid fa-comment" aria-hidden="true" /></button>
          <span className="diff-lineno">{newNumber}</span>
          <span className="diff-content">
            <span className="diff-prefix" aria-hidden="true">{(isAdded || isRemoved) ? line[0] : ' '}</span>
            {language
              ? <span dangerouslySetInnerHTML={{ __html: highlightCode(line.slice(1), language) }} />
              : line.slice(1)
            }
          </span>
          {'\n'}
        </span>,
        <span key={`${index}-comments`} className="diff-inline-comments">
          {hasThreads && threadsHere!.map((thread) => renderInlineThread(thread, isThreadRead, onToggleThreadRead, onAskComment, false, undefined, onToggleThreadResolved, isThreadStatusUpdating))}
          {hasComments && commentsHere!.map((entry, ci) =>
            renderInlineComment(entry, ci, isCommentRead, onToggleCommentRead, onGoToReview, isCommentFavorite, onToggleCommentFavorite, onOpenFollowUp, onAskComment, onSendToAdo, getCommentSentAt, filePath)
          )}
          {index < lines.length - 1 ? '\n' : ''}
        </span>
      ];
    }

    return (
      <span
        key={`${index}-${line.slice(0, 12)}`}
        className={lineClass}
        data-line-new={currentNewLine || undefined}
      >
        <span className="diff-lineno">{newNumber}</span>
        <span className="diff-content">
          <span className="diff-prefix" aria-hidden="true">{(isAdded || isRemoved) ? line[0] : ' '}</span>
          {language
            ? <span dangerouslySetInnerHTML={{ __html: highlightCode(line.slice(1), language) }} />
            : line.slice(1)
          }
        </span>
        {index < lines.length - 1 ? '\n' : ''}
      </span>
    );
  });
};

const renderSideBySideDiffLines = (
  diffText: string,
  language: string | undefined,
  lineComments?: Map<number, ReviewCommentEntry[]>,
  onGoToReview?: () => void,
  isCommentRead?: (commentKey: string) => boolean,
  onToggleCommentRead?: (commentKey: string) => void,
  isCommentFavorite?: (commentKey: string) => boolean,
  onToggleCommentFavorite?: (commentKey: string) => void,
  onOpenFollowUp?: (runId: string) => void,
  onAskComment?: (text: string) => void,
  onSendToAdo?: (entry: ReviewCommentEntry) => void,
  getCommentSentAt?: (commentKey: string) => string | null,
  lineThreads?: Map<number, PullRequestThread[]>,
  isThreadRead?: (threadId: number) => boolean,
  onToggleThreadRead?: (threadId: number) => void,
  onToggleThreadResolved?: (thread: PullRequestThread) => Promise<void>,
  isThreadStatusUpdating?: (threadId: number) => boolean,
  filePath?: string
) => {
  const lines = diffText.split('\n');
  let oldLine = 0;
  let newLine = 0;

  return lines.map((line, index) => {
    const hunk = line.startsWith('@@') ? parseHunkHeader(line) : null;
    if (hunk) {
      oldLine = hunk.oldStart;
      newLine = hunk.newStart;
      return (
        <div key={`side-${index}-hunk`} className="diff-side-row diff-side-row-meta">
          <div className="diff-side-cell diff-side-cell-full">{line}</div>
        </div>
      );
    }

    if (line.startsWith('+++') || line.startsWith('---') || line.startsWith('\\ No newline at end of file')) {
      return (
        <div key={`side-${index}-file`} className="diff-side-row diff-side-row-meta">
          <div className="diff-side-cell diff-side-cell-full">{line}</div>
        </div>
      );
    }

    // Other meta lines (diff --git, index, Binary files, etc.)
    if (/^(diff |index |Binary )/.test(line)) {
      return (
        <div key={`side-${index}-meta`} className="diff-side-row diff-side-row-meta">
          <div className="diff-side-cell diff-side-cell-full">{line}</div>
        </div>
      );
    }

    const isAdded = line.startsWith('+') && !line.startsWith('+++');
    const isRemoved = line.startsWith('-') && !line.startsWith('---');
    const currentNewLine = isRemoved ? null : newLine;
    const commentsHere = currentNewLine ? lineComments?.get(currentNewLine) : undefined;
    const hasComments = commentsHere && commentsHere.length > 0;
    const threadsHere = currentNewLine ? lineThreads?.get(currentNewLine) : undefined;
    const hasThreads = threadsHere && threadsHere.length > 0;

    const leftLineNumber = isAdded ? '' : String(oldLine || '');
    const rightLineNumber = isRemoved ? '' : String(newLine || '');
    const content = (isAdded || isRemoved || line.startsWith(' ')) ? line.slice(1) : line;

    const leftContent = isAdded ? '' : content;
    const rightContent = isRemoved ? '' : content;

    if (isAdded) newLine += 1;
    else if (isRemoved) oldLine += 1;
    else { oldLine += 1; newLine += 1; }

    const mainRow = (
      <div key={`side-${index}`} className="diff-side-row" data-line-new={currentNewLine || undefined}>
        <div className={`diff-side-cell ${isRemoved ? 'diff-side-cell-removed' : ''}`}>
          <span className="diff-side-lineno">{leftLineNumber}</span>
          {language
            ? <span className="diff-side-content" dangerouslySetInnerHTML={{ __html: highlightCode(leftContent, language) }} />
            : <span className="diff-side-content">{leftContent}</span>
          }
        </div>
        <div className={`diff-side-cell ${isAdded ? 'diff-side-cell-added' : ''} ${(hasComments || hasThreads) ? 'diff-side-cell-has-comment' : ''}`}>
          {(hasComments || hasThreads) && (
            <button
              type="button"
              className="diff-side-comment-marker"
              title="Has review comment — click to expand"
              onClick={(e) => {
                e.stopPropagation();
                const row = (e.currentTarget as HTMLElement).closest('.diff-side-row');
                let next = row?.nextSibling as Node | null;
                while (next && (next.nodeType !== 1 || !(next as Element).classList.contains('diff-side-row-comments'))) {
                  next = next.nextSibling;
                }
                if (next) {
                  const items = (next as Element).querySelectorAll<HTMLDetailsElement>('details.diff-inline-comment');
                  const anyOpen = Array.from(items).some(d => d.open);
                  items.forEach(d => { d.open = !anyOpen; });
                }
              }}
            ><i className="fa-solid fa-comment" aria-hidden="true" /></button>
          )}
          <span className="diff-side-lineno">{rightLineNumber}</span>
          {language
            ? <span className="diff-side-content" dangerouslySetInnerHTML={{ __html: highlightCode(rightContent, language) }} />
            : <span className="diff-side-content">{rightContent}</span>
          }
        </div>
      </div>
    );

    if (hasComments || hasThreads) {
      return [
        mainRow,
        <div key={`side-${index}-comments`} className="diff-side-row-comments">
          <div className="diff-side-inline-comments">
            {hasThreads && threadsHere!.map((thread) => renderInlineThread(thread, isThreadRead, onToggleThreadRead, onAskComment, false, undefined, onToggleThreadResolved, isThreadStatusUpdating))}
            {hasComments && commentsHere!.map((entry, ci) =>
              renderInlineComment(entry, ci, isCommentRead, onToggleCommentRead, onGoToReview, isCommentFavorite, onToggleCommentFavorite, onOpenFollowUp, onAskComment, onSendToAdo, getCommentSentAt, filePath)
            )}
          </div>
        </div>
      ];
    }

    return mainRow;
  });
};

const renderInlineThread = (
  thread: PullRequestThread,
  isThreadRead?: (threadId: number) => boolean,
  onToggleThreadRead?: (threadId: number) => void,
  onAskComment?: (text: string) => void,
  showFilePath?: boolean,
  onNavigateToLine?: (filePath: string, line?: number) => void,
  onToggleThreadResolved?: (thread: PullRequestThread) => Promise<void>,
  isThreadStatusUpdating?: (threadId: number) => boolean
) => {
  const isUpdating = isThreadStatusUpdating?.(thread.id) ?? false;
  const resolveTitle = thread.isResolved ? LABELS.reactivateComment : LABELS.resolveComment;

  return (
    <details
      key={`thread-${thread.id}`}
      className={`diff-inline-comment ado-thread ${thread.isResolved ? 'ado-resolved' : 'ado-active'} ${isThreadRead?.(thread.id) ? 'ado-thread-read' : ''}`}
      open={isThreadRead ? !isThreadRead(thread.id) : !thread.isResolved}
    >
      <summary className="diff-inline-comment-header">
        <span className="diff-inline-comment-avatar">
          <i className="fa-solid fa-comment-dots" aria-hidden="true" />
        </span>
        <span className="diff-inline-comment-meta">
          <span className="diff-inline-comment-author">
            {thread.comments[0]?.author ?? 'Unknown'}
          </span>
          {showFilePath && thread.filePath && onNavigateToLine ? (
            <span className="ado-thread-file-actions">
              <button
                type="button"
                className="comment-file-link"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onNavigateToLine(thread.filePath!, thread.line);
                }}
                title="Go to file in Changes"
              >
                <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" style={{ fontSize: 10, marginRight: 4 }} />
                {normalizePath(thread.filePath)}{thread.line ? `:${thread.line}` : ''}
              </button>
              <button
                type="button"
                className="comment-copy-btn"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void copyText(thread.filePath!);
                }}
                title="Copy file path"
                aria-label="Copy file path"
              >
                <i className="fa-regular fa-copy" aria-hidden="true" />
              </button>
            </span>
          ) : showFilePath && thread.filePath ? (
            <span className="badge tag" title={thread.filePath}>
              {normalizePath(thread.filePath)}
            </span>
          ) : null}
          {thread.line && <span className="badge tag">Line {thread.line}</span>}
          <span className={`badge tag ${thread.isResolved ? 'ado-badge-resolved' : 'ado-badge-active'}`}>
            {thread.isResolved ? 'Resolved' : 'Active'}
          </span>
          {thread.comments.length > 1 && (
            <span className="badge tag">{thread.comments.length} replies</span>
          )}
        </span>
        {onToggleThreadResolved && (
          <button
            type="button"
            className={`diff-inline-comment-thread-status-btn ${thread.isResolved ? 'active' : ''}`}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void onToggleThreadResolved(thread);
            }}
            title={resolveTitle}
            aria-label={resolveTitle}
            disabled={isUpdating}
          >
            <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : thread.isResolved ? 'fa-arrow-rotate-left' : 'fa-check'}`} aria-hidden="true" />
          </button>
        )}
        {onToggleThreadRead && (
          <button
            type="button"
            className="diff-inline-comment-read-btn"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleThreadRead(thread.id); }}
            title={isThreadRead?.(thread.id) ? 'Mark as unread' : 'Mark as read'}
            aria-label={isThreadRead?.(thread.id) ? 'Mark as unread' : 'Mark as read'}
          >
            <i className={`fa-solid ${isThreadRead?.(thread.id) ? 'fa-envelope-open' : 'fa-envelope'}`} aria-hidden="true" />
          </button>
        )}
        <i className="fa-solid fa-chevron-down diff-inline-comment-chevron" aria-hidden="true" />
      </summary>
      <div className="diff-inline-comment-body">
        {thread.comments.map((tc) => (
          <div key={tc.id} className="ado-thread-comment">
            <div className="ado-thread-comment-header">
              <strong>{tc.author}</strong>
              <span className="ado-thread-comment-date">
                {new Date(tc.publishedDate).toLocaleDateString(undefined, {
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            <CommentMarkdown
              content={tc.content}
              mode="auto"
              transformHtml={processAdoContent}
              className="ado-thread-comment-body"
            />
            {tc.likedBy && tc.likedBy.length > 0 && (
              <div className="ado-thread-comment-likes">
                {tc.likedBy.map((name) => (
                  <span key={name} className="ado-thread-comment-like">
                    <i className="fa-regular fa-thumbs-up" aria-hidden="true" />
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {onAskComment && (
          <div className="diff-inline-comment-actions">
            <button
              type="button"
              className="diff-inline-comment-action-btn"
              onClick={() => {
                const text = thread.comments.map((tc) => `${tc.author}: ${tc.content}`).join('\n');
                onAskComment(text);
              }}
              title="Ask Copilot about this thread"
            >
              <i className="fa-solid fa-comment-dots" aria-hidden="true" /> Ask me
            </button>
          </div>
        )}
      </div>
    </details>
  );
};

const renderInlineComment= (
  entry: ReviewCommentEntry,
  ci: number,
  isCommentRead?: (commentKey: string) => boolean,
  onToggleCommentRead?: (commentKey: string) => void,
  onGoToReview?: () => void,
  isCommentFavorite?: (commentKey: string) => boolean,
  onToggleCommentFavorite?: (commentKey: string) => void,
  onOpenFollowUp?: (runId: string) => void,
  onAskComment?: (text: string) => void,
  onSendToAdo?: (entry: ReviewCommentEntry) => void,
  getCommentSentAt?: (commentKey: string) => string | null,
  filePath?: string
) => {
  const sentAt = getCommentSentAt?.(entry.commentKey) ?? null;
  const sendTitle = sentAt ? LABELS.sentToAdoAt(formatSentTimestamp(sentAt)) : LABELS.sendToAdoTitle;

  return (
    <details
      key={ci}
      className={`diff-inline-comment ${isCommentRead?.(entry.commentKey) ? 'read' : ''} ${isCommentFavorite?.(entry.commentKey) ? 'favorite' : ''}`}
      open={!isCommentRead?.(entry.commentKey)}
    >
      <summary className="diff-inline-comment-header">
        <span className="diff-inline-comment-avatar">
          <i className="fa-solid fa-robot" aria-hidden="true" />
        </span>
        <span className="diff-inline-comment-meta">
          <span className="diff-inline-comment-author">Copilot · Run {entry.runNumber}</span>
          {entry.isFallbackPlacement && (
            <span className="badge tag diff-inline-fallback-badge" title="This comment could not be mapped to an exact line and was placed at the first displayed line.">
              <i className="fa-solid fa-map-pin" aria-hidden="true" /> File-level
            </span>
          )}
          {isCommentFavorite?.(entry.commentKey) && <span className="badge tag diff-inline-favorite-badge">To follow</span>}
          <span className={`badge severity ${getSeverityClass(entry.comment.severity ?? '')}`}>
            {entry.comment.severity ?? 'Info'}
          </span>
          {entry.comment.reviewArea && <span className="badge tag">{entry.comment.reviewArea}</span>}
          {entry.comment.category && <span className="badge tag">{entry.comment.category}</span>}
        </span>
        <CopyButton
          text={buildAdoCommentDraft(entry.comment, entry.runNumber, filePath)}
          title={LABELS.copyCommentMarkdown}
          className="diff-inline-comment-send-btn"
          feedback
        />
        {onSendToAdo && (
          <button
            type="button"
            className={`diff-inline-comment-send-btn ${sentAt ? 'active' : ''}`}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onSendToAdo(entry); }}
            title={sendTitle}
            aria-label={sendTitle}
          >
            <i className="fa-solid fa-paper-plane" aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className={`diff-inline-comment-favorite-btn ${isCommentFavorite?.(entry.commentKey) ? 'active' : ''}`}
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleCommentFavorite?.(entry.commentKey); }}
          title={isCommentFavorite?.(entry.commentKey) ? 'Remove from follow' : 'Mark to follow'}
          aria-label={isCommentFavorite?.(entry.commentKey) ? 'Remove from follow' : 'Mark to follow'}
        >
          <i className={`${isCommentFavorite?.(entry.commentKey) ? 'fa-solid' : 'fa-regular'} fa-star`} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="diff-inline-comment-read-btn"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleCommentRead?.(entry.commentKey); }}
          title={isCommentRead?.(entry.commentKey) ? 'Mark as unread' : 'Mark as read'}
          aria-label={isCommentRead?.(entry.commentKey) ? 'Mark as unread' : 'Mark as read'}
        >
          <i className={`fa-solid ${isCommentRead?.(entry.commentKey) ? 'fa-envelope-open' : 'fa-envelope'}`} aria-hidden="true" />
        </button>
        <i className="fa-solid fa-chevron-down diff-inline-comment-chevron" aria-hidden="true" />
      </summary>
      <div className="diff-inline-comment-body">
        <div className="diff-inline-comment-msg-row">
          <CommentMarkdown content={entry.comment.message ?? ''} className="diff-inline-comment-msg" />
          <CopyButton
            text={entry.comment.message ?? ''}
            title="Copy message"
            className="diff-inline-copy-btn"
            feedback
          />
        </div>
        {entry.comment.suggestion && (
          <div className="diff-inline-comment-suggestion">
            <div className="diff-inline-comment-suggestion-header">
              <strong>Suggestion:</strong>
              <CopyButton
                text={entry.comment.suggestion ?? ''}
                title="Copy suggestion"
                className="diff-inline-copy-btn"
                feedback
              />
            </div>
            <CommentMarkdown content={entry.comment.suggestion} />
          </div>
        )}
        {entry.comment.solution && (
          <div className="diff-inline-comment-solution">
            <div className="diff-inline-comment-suggestion-header">
              <strong>Solution:</strong>
              <CopyButton
                text={entry.comment.solution ?? ''}
                title="Copy solution"
                className="diff-inline-copy-btn"
                feedback
              />
            </div>
            <CommentMarkdown content={entry.comment.solution} />
          </div>
        )}
        {entry.comment.evidence && (
          <div className="diff-inline-comment-evidence">
            <strong>Evidence:</strong>
            <CommentMarkdown content={entry.comment.evidence} />
          </div>
        )}
        <div className="diff-inline-comment-actions">
          <button
            type="button"
            className="diff-inline-comment-action-btn"
            onClick={() => onOpenFollowUp?.(entry.runId)}
            title="Open follow-up chat for this review run"
          >
            <i className="fa-solid fa-comments" aria-hidden="true" /> Follow-up
          </button>
          {onAskComment && (
            <button
              type="button"
              className="diff-inline-comment-action-btn"
              onClick={() => {
                const parts = [entry.comment.message ?? ''];
                if (entry.comment.suggestion) parts.push(`Suggestion: ${entry.comment.suggestion}`);
                if (entry.comment.solution) parts.push(`Solution: ${entry.comment.solution}`);
                onAskComment(parts.join('\n'));
              }}
              title="Ask Copilot about this comment"
            >
              <i className="fa-solid fa-comment-dots" aria-hidden="true" /> Ask me
            </button>
          )}
          <button
            type="button"
            className="diff-inline-comment-action-btn"
            onClick={onGoToReview}
            title="Go to Reviews tab"
          >
            <i className="fa-solid fa-arrow-up-right-from-square" aria-hidden="true" /> Reviews
          </button>
        </div>
      </div>
    </details>
  );
};
