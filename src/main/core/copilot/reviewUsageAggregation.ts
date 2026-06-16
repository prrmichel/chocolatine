import type { ReviewAttemptUsageSummary } from '@shared/types/models';

interface UsageSnapshot {
  modelUsed: string | null;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  durationMs: number | null;
  estimatedCost: number | null;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const toTokenCount = (value: unknown): number => {
  const parsed = toNumberOrNull(value);
  return parsed == null ? 0 : Math.max(0, Math.round(parsed));
};

const parseUsageSnapshot = (payload: unknown): UsageSnapshot => {
  const usage = (payload && typeof payload === 'object') ? payload as Record<string, unknown> : {};
  const modelValue = usage.model;
  return {
    modelUsed: typeof modelValue === 'string' && modelValue.trim() ? modelValue.trim() : null,
    inputTokens: toTokenCount(usage.inputTokens),
    outputTokens: toTokenCount(usage.outputTokens),
    cacheReadTokens: toTokenCount(usage.cacheReadTokens),
    cacheWriteTokens: toTokenCount(usage.cacheWriteTokens),
    durationMs: toNumberOrNull(usage.duration),
    estimatedCost: toNumberOrNull(usage.cost)
  };
};

export class ReviewAttemptUsageAggregator {
  private modelUsed: string | null = null;
  private inputTokens = 0;
  private outputTokens = 0;
  private cacheReadTokens = 0;
  private cacheWriteTokens = 0;
  private durationMs = 0;
  private requestCount = 0;
  private estimatedCost = 0;
  private hasDuration = false;
  private hasCost = false;

  add(payload: unknown): UsageSnapshot | null {
    const snapshot = parseUsageSnapshot(payload);
    const hasSignal = snapshot.modelUsed
      || snapshot.inputTokens > 0
      || snapshot.outputTokens > 0
      || snapshot.cacheReadTokens > 0
      || snapshot.cacheWriteTokens > 0
      || snapshot.durationMs != null
      || snapshot.estimatedCost != null;
    if (!hasSignal) {
      return null;
    }

    if (snapshot.modelUsed) {
      this.modelUsed = snapshot.modelUsed;
    }
    this.inputTokens += snapshot.inputTokens;
    this.outputTokens += snapshot.outputTokens;
    this.cacheReadTokens += snapshot.cacheReadTokens;
    this.cacheWriteTokens += snapshot.cacheWriteTokens;
    if (snapshot.durationMs != null && snapshot.durationMs >= 0) {
      this.durationMs += Math.round(snapshot.durationMs);
      this.hasDuration = true;
    }
    if (snapshot.estimatedCost != null && Number.isFinite(snapshot.estimatedCost)) {
      this.estimatedCost += snapshot.estimatedCost;
      this.hasCost = true;
    }
    this.requestCount += 1;
    return snapshot;
  }

  toSummary(fallbackModel: string): ReviewAttemptUsageSummary | null {
    if (this.requestCount === 0) {
      return null;
    }
    const totalTokens = this.inputTokens + this.outputTokens + this.cacheReadTokens + this.cacheWriteTokens;
    return {
      modelUsed: this.modelUsed ?? fallbackModel,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      cacheReadTokens: this.cacheReadTokens,
      cacheWriteTokens: this.cacheWriteTokens,
      totalTokens,
      ...(this.hasDuration ? { durationMs: this.durationMs } : {}),
      ...(this.requestCount > 0 ? { requestCount: this.requestCount } : {}),
      ...(this.hasCost ? { estimatedCost: Number(this.estimatedCost.toFixed(6)) } : {})
    };
  }
}

export const formatUsageSnapshotLog = (snapshot: UsageSnapshot): string => {
  const tokens = snapshot.inputTokens + snapshot.outputTokens + snapshot.cacheReadTokens + snapshot.cacheWriteTokens;
  const parts = [
    `tokens=${tokens}`,
    `in=${snapshot.inputTokens}`,
    `out=${snapshot.outputTokens}`
  ];
  if (snapshot.cacheReadTokens > 0) {
    parts.push(`cache-read=${snapshot.cacheReadTokens}`);
  }
  if (snapshot.cacheWriteTokens > 0) {
    parts.push(`cache-write=${snapshot.cacheWriteTokens}`);
  }
  if (snapshot.modelUsed) {
    parts.push(`model=${snapshot.modelUsed}`);
  }
  if (snapshot.durationMs != null && snapshot.durationMs >= 0) {
    parts.push(`duration=${Math.round(snapshot.durationMs)}ms`);
  }
  if (snapshot.estimatedCost != null) {
    parts.push(`cost=${snapshot.estimatedCost}`);
  }
  return `Review usage diagnostics: ${parts.join(' | ')}`;
};

export const formatAttemptUsageSummaryLog = (summary: ReviewAttemptUsageSummary): string => {
  const parts = [
    `tokens=${summary.totalTokens}`,
    `in=${summary.inputTokens}`,
    `out=${summary.outputTokens}`,
    `model=${summary.modelUsed}`
  ];
  if (summary.cacheReadTokens > 0) {
    parts.push(`cache-read=${summary.cacheReadTokens}`);
  }
  if (summary.cacheWriteTokens > 0) {
    parts.push(`cache-write=${summary.cacheWriteTokens}`);
  }
  if (summary.durationMs != null) {
    parts.push(`duration=${summary.durationMs}ms`);
  }
  if (summary.requestCount != null) {
    parts.push(`requests=${summary.requestCount}`);
  }
  if (summary.estimatedCost != null) {
    parts.push(`cost=${summary.estimatedCost}`);
  }
  return `Review attempt usage summary: ${parts.join(' | ')}`;
};
