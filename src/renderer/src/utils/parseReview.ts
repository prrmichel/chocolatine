import { CopilotReviewComment, CopilotReviewResult, ReviewJob } from '@shared/types/models';

/**
 * Parse a review job's response into a structured CopilotReviewResult.
 * For multi-batch reviews the response contains multiple JSON objects
 * separated by `---`; each one is parsed and their comments are merged.
 */
export const parseReview = (job: ReviewJob): CopilotReviewResult | null => {
  if (job.persistedResult) {
    return job.persistedResult;
  }
  if (!job.reviewResponse) {
    return null;
  }
  return parseReviewText(job.reviewResponse);
};

const parseReviewText = (text: string): CopilotReviewResult | null => {
  // Try to find all JSON objects in the text (supports multi-batch responses)
  const results = extractAllJsonObjects(text)
    .map((json) => parseSingleReviewJson(json))
    .filter((r): r is CopilotReviewResult => r !== null);

  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  // Merge multiple batch results into one
  const merged: CopilotReviewResult = {
    titleReview: results.find((r) => r.titleReview)?.titleReview,
    overallSummary: results.map((r) => r.overallSummary).filter(Boolean).join('\n\n---\n\n'),
    comments: results.flatMap((r) => r.comments ?? []),
    reviewMetadata: results.find((r) => r.reviewMetadata)?.reviewMetadata,
    skillMarkerUsage: mergeSkillMarkerUsage(results)
  };
  return merged;
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
      .map((comment) => normalizeComment(comment))
      .filter((comment): comment is CopilotReviewComment => Boolean(comment));

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
          break;
        }
      }

      // If we reach end without closing, move past the opening brace
      if (i === text.length - 1) {
        pos = start + 1;
      }
    }

    // Safety: if depth never reached 0, advance past the start
    if (depth !== 0) {
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

  const normalized: CopilotReviewComment = {
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

  return normalized;
};

const toOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toLineNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }
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
