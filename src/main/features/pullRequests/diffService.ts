import { createTwoFilesPatch } from 'diff';

export interface DiffResult {
  diffText: string;
  hasMeaningfulDiff: boolean;
}

export class DiffService {
  buildDiff(baseText: string, targetText: string, contextLines = 20): DiffResult {
    if (!baseText && !targetText) {
      return { diffText: '', hasMeaningfulDiff: false };
    }

    const normalizedBase = normalize(baseText ?? '');
    const normalizedTarget = normalize(targetText ?? '');

    const patch = createTwoFilesPatch('a', 'b', normalizedBase, normalizedTarget, '', '', { context: contextLines });
    const lines = patch.split('\n');
    const contentLines = lines.filter((line) => line.startsWith('@@') || line.startsWith('+') || line.startsWith('-') || line.startsWith(' '));

    if (!contentLines.some((line) => line.startsWith('+') || line.startsWith('-'))) {
      return { diffText: '(No meaningful text diff detected)', hasMeaningfulDiff: false };
    }

    const hunks: string[] = [];
    let current: string[] = [];
    for (const line of contentLines) {
      if (line.startsWith('@@')) {
        if (current.length > 0) {
          hunks.push(current.join('\n'));
        }
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      hunks.push(current.join('\n'));
    }

    const sb: string[] = ['```diff'];

    for (const hunk of hunks) {
      const hunkLines = hunk.split('\n');
      for (const hunkLine of hunkLines) {
        sb.push(hunkLine);
      }
      sb.push('');
    }

    sb.push('```');
    return { diffText: sb.join('\n').trimEnd(), hasMeaningfulDiff: true };
  }
}

const normalize = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n');
