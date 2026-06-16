import {
  CopilotReviewComment,
  PullRequestFileDiff,
  PullRequestReviewer,
  ReviewJob
} from '@shared/types/models';

// ── Date / label formatting ──

export const formatRunDate = (job: ReviewJob): string => {
  const raw = job.completedAt ?? job.startedAt ?? job.queuedAt;
  return new Date(raw).toLocaleString();
};

export const formatReviewerStatus = (reviewer: PullRequestReviewer): string => {
  const vote = reviewer.vote ?? 0;
  if (vote >= 10) return reviewer.isRequired ? 'Approved (Required)' : 'Approved';
  if (vote >= 5) return reviewer.isRequired ? 'Approved w/ suggestions (Required)' : 'Approved w/ suggestions';
  if (vote <= -10) return reviewer.isRequired ? 'Rejected (Required)' : 'Rejected';
  if (vote <= -5) return reviewer.isRequired ? 'Waiting for author (Required)' : 'Waiting for author';
  return reviewer.isRequired ? 'No vote (Required)' : 'No vote';
};

export const formatSeverityFilterLabel = (severityClass: string): string => {
  if (severityClass === 'severity-error') return 'Error';
  if (severityClass === 'severity-warning') return 'Warning';
  return 'Info';
};

// ── Path normalization ──

export const normalizePath = (path: string): string =>
  path
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/^file:\s*/i, '')
    .replace(/\\/g, '/')
    .replace(/^\.+\//, '')
    .replace(/^(?:a|b)\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .toLowerCase();

const sanitizePathPreserveCase = (path: string): string =>
  path
    .trim()
    .replace(/^['"`]+|['"`]+$/g, '')
    .replace(/^file:\s*/i, '')
    .replace(/\\/g, '/')
    .replace(/^\.+\//, '')
    .replace(/^(?:a|b)\//, '')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');

export const arePathsEquivalent = (left: string, right: string): boolean => {
  const normalizedLeft = normalizePath(left);
  const normalizedRight = normalizePath(right);
  if (!normalizedLeft || !normalizedRight) {
    return false;
  }
  if (normalizedLeft === normalizedRight) {
    return true;
  }
  return normalizedLeft.endsWith(`/${normalizedRight}`) || normalizedRight.endsWith(`/${normalizedLeft}`);
};

// ── Comment read-state key ──

export const buildCommentReadKey = (
  runId: string,
  comment: CopilotReviewComment,
  commentIndex: number
): string =>
  comment.id
    ? `${runId}::${comment.id}`
    : `${runId}::${normalizePath(comment.file ?? '')}::${comment.lineNew ?? ''}::${comment.lineOld ?? ''}::${(comment.message ?? '').slice(0, 120)}::${commentIndex}`;

// ── File icons ──

export const getFileIconClass = (name: string): string => {
  const extension = name.includes('.') ? name.split('.').pop()?.toLowerCase() : '';
  switch (extension) {
    case 'cshtml': return 'fa-file-code file-cshtml';
    case 'cs': return 'fa-file-code file-cs';
    case 'sql': return 'fa-database file-sql';
    case 'css': return 'fa-file-code file-css';
    case 'js':
    case 'jsx': return 'fa-file-code file-js';
    case 'ts':
    case 'tsx': return 'fa-file-code file-ts';
    case 'json': return 'fa-file-code file-json';
    case 'md': return 'fa-file-lines file-md';
    case 'html':
    case 'htm': return 'fa-file-code file-html';
    default: return 'fa-file file-default';
  }
};

// ── Change type display ──

export const getChangeTypeClass = (changeType: string): string => {
  switch (changeType) {
    case 'add': return 'change-add';
    case 'edit': return 'change-edit';
    case 'delete': return 'change-delete';
    case 'rename': return 'change-rename';
    default: return 'change-other';
  }
};

export const getChangeTypeIcon = (changeType: string): string => {
  switch (changeType) {
    case 'add': return '+';
    case 'edit': return '●';
    case 'delete': return '−';
    case 'rename': return '→';
    default: return '?';
  }
};

// ── HTML / text helpers ──

export const htmlToText = (value: string): string => {
  if (!value.includes('<') && !value.includes('&')) return value;
  const parser = new DOMParser();
  const doc = parser.parseFromString(value, 'text/html');
  return doc.body.textContent ?? '';
};

export const getTextValue = (value?: string): string => {
  const text = htmlToText(value ?? '').trim();
  return text || '(Empty)';
};

export const normalizeWorkItemComment = (comment: unknown): { author?: string; text: string } => {
  if (typeof comment === 'string') return { text: comment };
  if (comment && typeof comment === 'object') {
    const candidate = comment as { author?: unknown; text?: unknown };
    const author = typeof candidate.author === 'string' ? candidate.author : '';
    const text = typeof candidate.text === 'string' ? candidate.text : '';
    return { author, text };
  }
  return { text: '' };
};

// ── File tree ──

export type FileTreeNode = {
  name: string;
  path: string;
  children: FileTreeNode[];
  diff?: PullRequestFileDiff;
};

export const buildFileTree = (diffs: PullRequestFileDiff[]): FileTreeNode[] => {
  const root: FileTreeNode = { name: '', path: '', children: [] };

  for (const diff of diffs) {
    const cleanPath = sanitizePathPreserveCase(diff.path);
    const parts = cleanPath.split('/').filter(Boolean);
    let current = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let node = current.children.find((child) => child.name.toLowerCase() === part.toLowerCase());
      if (!node) {
        node = { name: part, path: currentPath, children: [] };
        current.children.push(node);
      }
      if (index === parts.length - 1) node.diff = diff;
      current = node;
    });
  }

  return sortTree(root.children);
};

const sortTree = (nodes: FileTreeNode[]): FileTreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    const aFolder = a.children.length > 0 && !a.diff;
    const bFolder = b.children.length > 0 && !b.diff;
    if (aFolder !== bFolder) return aFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  for (const node of sorted) {
    if (node.children.length > 0) node.children = sortTree(node.children);
  }
  return sorted;
};

export const filterTree = (nodes: FileTreeNode[], query: string): FileTreeNode[] => {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return nodes;

  const matches = (node: FileTreeNode) =>
    node.name.toLowerCase().includes(normalized) ||
    node.path.toLowerCase().includes(normalized);

  const filterNode = (node: FileTreeNode): FileTreeNode | null => {
    if (node.children.length === 0) return matches(node) ? node : null;
    const filteredChildren = node.children
      .map((child) => filterNode(child))
      .filter((child): child is FileTreeNode => Boolean(child));
    if (filteredChildren.length > 0 || matches(node)) return { ...node, children: filteredChildren };
    return null;
  };

  return nodes
    .map((node) => filterNode(node))
    .filter((node): node is FileTreeNode => Boolean(node));
};

// ── Evidence / diff line matching ──

export type DisplayedLine = { lineNumber: number; content: string };

export const normalizeEvidenceText = (value: string): string =>
  value
    .replace(/[`'"""'']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

export const findLineByEvidence = (
  evidence: string | undefined,
  displayedLines: DisplayedLine[]
): number | null => {
  if (!evidence || displayedLines.length === 0) {
    return null;
  }

  const candidates = evidence
    .split('\n')
    .map((part) => normalizeEvidenceText(part))
    .filter((part) => part.length >= 6)
    .sort((a, b) => b.length - a.length)
    .slice(0, 4);

  const fullEvidence = normalizeEvidenceText(evidence);
  if (fullEvidence.length >= 6) {
    candidates.unshift(fullEvidence);
  }

  const uniqueCandidates = [...new Set(candidates)];
  if (uniqueCandidates.length === 0) {
    return null;
  }

  for (const candidate of uniqueCandidates) {
    const exact = displayedLines.find(
      (line) => normalizeEvidenceText(line.content) === candidate
    );
    if (exact) {
      return exact.lineNumber;
    }
  }

  let bestMatch: { lineNumber: number; score: number } | null = null;
  for (const line of displayedLines) {
    const normalizedLine = normalizeEvidenceText(line.content);
    if (normalizedLine.length === 0) {
      continue;
    }

    for (const candidate of uniqueCandidates) {
      if (normalizedLine.includes(candidate) || candidate.includes(normalizedLine)) {
        const score = Math.min(normalizedLine.length, candidate.length);
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { lineNumber: line.lineNumber, score };
        }
      }
    }
  }

  return bestMatch?.score && bestMatch.score >= 10 ? bestMatch.lineNumber : null;
};

export const getDisplayedNewLineInfo = (
  diffText: string
): {
  firstDisplayedNewLine: number;
  displayedNewLines: Set<number>;
  displayedLines: DisplayedLine[];
} => {
  const displayedNewLines = new Set<number>();
  const displayedLines: DisplayedLine[] = [];
  let newLine = 0;

  for (const line of diffText.split('\n')) {
    if (line.startsWith('@@')) {
      const match = /@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      if (match) {
        newLine = Number(match[1]);
      }
      continue;
    }

    if (
      line.startsWith('+++') ||
      line.startsWith('---') ||
      line.startsWith('\\ No newline at end of file')
    ) {
      continue;
    }

    const isRemoved = line.startsWith('-') && !line.startsWith('---');
    if (!isRemoved && newLine > 0) {
      displayedNewLines.add(newLine);
      const content =
        line.startsWith('+') || line.startsWith(' ') ? line.slice(1) : line;
      displayedLines.push({ lineNumber: newLine, content });
      newLine += 1;
      continue;
    }

    if (!isRemoved) {
      newLine += 1;
    }
  }

  return {
    firstDisplayedNewLine: displayedNewLines.values().next().value ?? 1,
    displayedNewLines,
    displayedLines
  };
};
