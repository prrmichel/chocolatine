import { CopilotReviewComment, CopilotReviewResult, ReviewJob } from '../../shared/types/models';

/**
 * Server-side review parser.
 * Extracts structured review data from a ReviewJob's raw response.
 * Mirror of the renderer-side parseReview — kept in main/ so the
 * queue service can parse prior findings for cross-model context injection.
 * Supports multi-batch responses (multiple JSON objects separated by `---`).
 */
export const parseReview = (job: ReviewJob): CopilotReviewResult | null => {
  return job.persistedResult ?? parseReviewResponse(job.reviewResponse);
};

/**
 * Parse a raw review response string into a structured CopilotReviewResult.
 * For multi-batch responses, extracts all JSON objects and merges their comments.
 */
export const parseReviewResponse = (response?: string | null): CopilotReviewResult | null => {
  if (!response) {
    return null;
  }
  const jsonObjects = extractAllJsonObjects(response);
  const results = jsonObjects
    .map((json) => parseSingleReviewJson(json))
    .filter((r): r is CopilotReviewResult => r !== null);

  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  // Merge multiple batch results
  return {
    titleReview: results.find((r) => r.titleReview)?.titleReview,
    overallSummary: results.map((r) => r.overallSummary).filter(Boolean).join('\n\n---\n\n'),
    comments: results.flatMap((r) => r.comments ?? []),
    reviewMetadata: results.find((r) => r.reviewMetadata)?.reviewMetadata,
    skillMarkerUsage: mergeSkillMarkerUsage(results)
  };
};

const parseSingleReviewJson = (jsonStr: string): CopilotReviewResult | null => {
  try {
    const parsed = JSON.parse(jsonStr) as CopilotReviewResult & { comments?: unknown[] };
    const skillMarkerUsage = normalizeSkillMarkerUsage(parsed.skillMarkerUsage);
    if (!Array.isArray(parsed.comments)) {
      return {
        ...parsed,
        skillMarkerUsage
      };
    }

    const normalizedComments = parsed.comments
      .map((comment: unknown) => normalizeComment(comment))
      .filter((comment: CopilotReviewComment | null): comment is CopilotReviewComment => Boolean(comment));

    return {
      ...parsed,
      comments: normalizedComments,
      skillMarkerUsage
    };
  } catch {
    return null;
  }
};

/**
 * Build a condensed text summary of a completed review's findings.
 * Used to inject prior findings from other models into a review prompt.
 *
 * Format:
 *   [SEVERITY] file.ts:42 — Message text
 */
export const buildFindingsSummary = (job: ReviewJob): string | null => {
  const result = parseReview(job);
  if (!result?.comments?.length) {
    return null;
  }

  const lines: string[] = [];
  for (const c of result.comments) {
    const severity = (c.severity ?? 'INFO').toUpperCase();
    const file = c.file ?? '?';
    const line = c.lineNew ?? c.lineOld ?? '?';
    const message = c.message ?? c.suggestion ?? '(no message)';
    lines.push(`[${severity}] ${file}:${line} — ${message}`);
  }

  if (result.overallSummary) {
    lines.push('');
    lines.push(`Overall: ${result.overallSummary}`);
  }

  return lines.join('\n');
};

// ─── Private helpers ──────────────────────────────────────────────

/**
 * Extract all complete top-level JSON objects from a string using bracket-depth
 * counting.  Correctly handles `{` and `}` inside string values and escape
 * sequences.
 */
const extractAllJsonObjects = (text: string): string[] => {
  const results: string[] = [];
  let pos = 0;

  while (pos < text.length) {
    const start = text.indexOf('{', pos);
    if (start < 0) break;

    let depth = 0;
    let inString = false;
    let escape = false;
    let found = false;

    for (let i = start; i < text.length; i++) {
      const ch = text[i];

      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          results.push(text.substring(start, i + 1));
          pos = i + 1;
          found = true;
          break;
        }
      }
    }

    if (!found) {
      pos = start + 1;
    }
  }

  return results;
};

const normalizeComment = (input: unknown): CopilotReviewComment | null => {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const source = input as Record<string, unknown>;

  const lineNew = toLineNumber(
    source.lineNew ?? source.newLine ?? source.line_new ?? source.line ?? source.lineNumber ?? source.line_number
  );

  const lineOld = toLineNumber(
    source.lineOld ?? source.oldLine ?? source.line_old ?? source.originalLine ?? source.original_line
  );

  return {
    id: toOptionalString(source.id),
    reviewArea: toOptionalString(source.reviewArea),
    category: toOptionalString(source.category),
    severity: toOptionalString(source.severity),
    file: toOptionalString(source.file ?? source.filePath ?? source.path ?? source.filename),
    lineNew,
    lineOld,
    message: toOptionalString(source.message),
    solution: toOptionalString(source.solution),
    suggestion: toOptionalString(source.suggestion),
    evidence: toOptionalString(source.evidence)
  };
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toLineNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
};

const normalizeSkillMarkerUsage = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const matches = value.match(/SKILL_MARKER_[A-Z0-9_]+/g);
  if (!matches || matches.length === 0) {
    return undefined;
  }

  return Array.from(new Set(matches)).join(' ');
};

const mergeSkillMarkerUsage = (results: CopilotReviewResult[]): string | undefined => {
  const markers = results.flatMap((result) => result.skillMarkerUsage?.match(/SKILL_MARKER_[A-Z0-9_]+/g) ?? []);
  if (markers.length === 0) {
    return undefined;
  }

  return Array.from(new Set(markers)).join(' ');
};
