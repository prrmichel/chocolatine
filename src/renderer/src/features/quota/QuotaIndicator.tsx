import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@renderer/services/api';
import type { CopilotQuotaSnapshot } from '@shared/types/quota';
import styles from './QuotaIndicator.module.css';

const QUOTA_TYPE = 'premium_interactions';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

const MIN_OVERAGE_WIDTH_PX = 12;
const MAX_OVERAGE_WIDTH_PX = 120;

type QuotaState =
  | { readonly status: 'loading' }
  | { readonly status: 'refreshing'; readonly snapshot: CopilotQuotaSnapshot }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'not-available' }
  | { readonly status: 'unlimited' }
  | { readonly status: 'loaded'; readonly snapshot: CopilotQuotaSnapshot };

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Returns CSS class based on consumed percentage (0-100). */
function consumedColorClass(consumedPct: number): string {
  if (consumedPct >= 80) return styles.red;
  if (consumedPct >= 50) return styles.yellow;
  return styles.green;
}

/** Computes the clamped pixel width for the overage segment. Returns 0 when no overage. */
function computeOverageWidth(overage: number, entitlementRequests: number, hasOverage: boolean): number {
  if (!hasOverage) return 0;
  const raw = entitlementRequests > 0
    ? Math.round((overage / entitlementRequests) * 150)
    : 0;
  return Math.max(MIN_OVERAGE_WIDTH_PX, Math.min(MAX_OVERAGE_WIDTH_PX, raw));
}

export function QuotaIndicator() {
  const [state, setState] = useState<QuotaState>({ status: 'loading' });
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const snapshotRef = useRef<CopilotQuotaSnapshot | null>(null);
  const lastRefreshedRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Keep snapshotRef in sync with state so fetchQuota can read it without a dep
  useEffect(() => {
    if (state.status === 'loaded' || state.status === 'refreshing') {
      snapshotRef.current = state.snapshot;
    } else {
      snapshotRef.current = null;
    }
  }, [state]);

  const fetchQuotaRef = useRef<(isRefresh?: boolean) => Promise<void>>(async () => {});
  fetchQuotaRef.current = async (isRefresh = false) => {
    if (isRefresh && snapshotRef.current !== null) {
      setState({ status: 'refreshing', snapshot: snapshotRef.current });
    } else if (!isRefresh) {
      setState({ status: 'loading' });
    }

    try {
      const data = await api.getCopilotQuota();
      if (!mountedRef.current) return;

      const snapshot = data.quotaSnapshots?.[QUOTA_TYPE];
      if (!snapshot) {
        setState({ status: 'not-available' });
        lastRefreshedRef.current = new Date();
        return;
      }

      if (snapshot.isUnlimitedEntitlement) {
        setState({ status: 'unlimited' });
        lastRefreshedRef.current = new Date();
        return;
      }

      setState({status: 'loaded', snapshot: snapshot});
      lastRefreshedRef.current = new Date();
    } catch (err) {
      if (!mountedRef.current) return;
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  };

  // Initial fetch + polling (runs once on mount)
  useEffect(() => {
    mountedRef.current = true;
    fetchQuotaRef.current();

    intervalRef.current = setInterval(() => fetchQuotaRef.current(), REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fetchQuotaRef.current(true);
  }, []);

  const handleBarClick = useCallback(() => {
    setTooltipOpen((prev) => !prev);
  }, []);

  // Close tooltip on outside click
  useEffect(() => {
    if (!tooltipOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setTooltipOpen(false);
      }
    };

    // Defer adding the listener so the click that opened the tooltip
    // doesn't immediately close it.
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [tooltipOpen]);

  const getSnapshot = (): CopilotQuotaSnapshot | null => {
    if (state.status === 'loaded' || state.status === 'refreshing') return state.snapshot;
    return null;
  };

  const isLoading = state.status === 'loading' || state.status === 'refreshing';

  const renderRefreshBtn = () => (
    <button
      className={`${styles.refreshBtn} ${isLoading ? styles.spinning : ''}`}
      onClick={handleRefresh}
      aria-label="Refresh quota"
      title="Refresh quota"
    >
      <i className="fa-solid fa-rotate-right" aria-hidden="true" />
    </button>
  );

  const renderBar = () => {
    const snapshot = getSnapshot();

    switch (state.status) {
      case 'loading':
        return (
          <div className={`${styles.bar} ${styles.loading}`}>
            <span className={styles.label}>â€¦</span>
            {renderRefreshBtn()}
          </div>
        );

      case 'error':
        return (
          <div className={`${styles.bar} ${styles.error}`}>
            <span className={styles.label}>Err</span>
            {renderRefreshBtn()}
          </div>
        );

      case 'not-available':
        return (
          <div className={`${styles.bar} ${styles.na}`}>
            <span className={styles.label}>N/A</span>
            {renderRefreshBtn()}
          </div>
        );

      case 'unlimited':
        return (
          <div className={`${styles.bar} ${styles.green}`}>
            <div className={styles.fill} style={{ width: '100%' }} />
            <span className={styles.label}>âˆž</span>
            {renderRefreshBtn()}
          </div>
        );

      case 'refreshing':
      case 'loaded': {
        if (!snapshot) return null;
        const { usedRequests, entitlementRequests, overage } = snapshot;
        const hasOverage = overage > 0;
        const fillPct = entitlementRequests > 0
          ? Math.min(100, Math.round((usedRequests / entitlementRequests) * 100))
          : 0;
        const overageWidthPx = computeOverageWidth(overage, entitlementRequests, hasOverage);
        const fillClass = hasOverage ? styles.red : consumedColorClass(fillPct);
        const barStyle = hasOverage
          ? { width: `${150 + overageWidthPx}px` }
          : undefined;
        const fillStyle = hasOverage
          ? { width: '150px' }
          : { width: `${fillPct}%` };
        return (
          <div
            className={`${styles.bar} ${fillClass} ${state.status === 'refreshing' ? styles.refreshing : ''}`}
            style={barStyle}
          >
            <div
              className={`${styles.fill} ${hasOverage ? styles.noRightRadius : ''}`}
              style={fillStyle}
            />
            {hasOverage && (
              <div className={styles.fillOverage} style={{ width: `${overageWidthPx}px` }} />
            )}
            <span className={styles.label}>
              {hasOverage
                ? `${formatNumber(usedRequests)} / ${formatNumber(entitlementRequests)} (+${formatNumber(overage)})`
                : `${formatNumber(usedRequests)} / ${formatNumber(entitlementRequests)} (${fillPct}%)`}
            </span>
            {renderRefreshBtn()}
          </div>
        );
      }
    }
  };

  const renderTooltip = () => {
    const snapshot = getSnapshot();

    if (!snapshot) {
      switch (state.status) {
        case 'loading':
          return (
            <div className={styles.tooltip}>
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipTitle}>Copilot Quota</span>
              </div>
              <div className={styles.tooltipFooter}>Loadingâ€¦</div>
            </div>
          );
        case 'error':
          return (
            <div className={styles.tooltip}>
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipTitle}>Copilot Quota</span>
              </div>
              <div className={styles.tooltipFooter}>Error: {state.message}</div>
            </div>
          );
        case 'not-available':
          return (
            <div className={styles.tooltip}>
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipTitle}>Copilot Quota</span>
              </div>
              <div className={styles.tooltipFooter}>
                No quota data for &ldquo;{QUOTA_TYPE.replace(/_/g, ' ')}&rdquo;.
              </div>
            </div>
          );
        default:
          return null;
      }
    }

    const {
      usedRequests,
      entitlementRequests,
      overage,
      usageAllowedWithExhaustedQuota,
      overageAllowedWithExhaustedQuota
    } = snapshot;

    const hasOverage = overage > 0;
    const consumedPct = entitlementRequests > 0
      ? Math.min(100, Math.round((usedRequests / entitlementRequests) * 100))
      : 0;
    const overageWidthPx = computeOverageWidth(overage, entitlementRequests, hasOverage);
    const remaining = entitlementRequests > 0
      ? Math.max(0, entitlementRequests - usedRequests)
      : 0;

    const lastRefreshLabel = lastRefreshedRef.current
      ? lastRefreshedRef.current.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      : null;

    return (
      <div className={styles.tooltip}>
        <div className={styles.tooltipHeader}>
          <span className={styles.tooltipTitle}>Copilot Quota</span>
          <span className={styles.tooltipSubtitle}>{QUOTA_TYPE.replace(/_/g, ' ')}</span>
        </div>

        <div className={styles.tooltipSection}>
          <div className={styles.tooltipUsage}>
            <span className={styles.tooltipUsageValue}>{usedRequests.toLocaleString()}</span>
            <span className={styles.tooltipUsageLabel}>used of</span>
            <span className={styles.tooltipUsageValue}>{entitlementRequests.toLocaleString()}</span>
          </div>
          <div className={`${styles.tooltipBar} ${hasOverage ? styles.hasOverage : ''}`}>
            <div
              className={styles.tooltipBarFill}
              style={{ width: `${consumedPct}%` }}
            />
            {hasOverage && (
              <div
                className={styles.tooltipBarFillOverage}
                style={{ width: `${overageWidthPx}px` }}
              />
            )}
          </div>
          <div className={styles.tooltipBarLabels}>
            <span>{hasOverage ? `${consumedPct}% consumed (+${overage.toLocaleString()})` : `${consumedPct}% consumed`}</span>
            <span>{remaining.toLocaleString()} remaining</span>
          </div>
        </div>

        {(hasOverage || usageAllowedWithExhaustedQuota || overageAllowedWithExhaustedQuota) && (
          <div className={styles.tooltipDivider} />
        )}

        <div className={styles.tooltipDetails}>
          {hasOverage && (
            <div className={styles.tooltipRow}>
              <span>Above limit</span>
              <span>+{overage.toLocaleString()} requests</span>
            </div>
          )}
          {usageAllowedWithExhaustedQuota && (
            <div className={styles.tooltipRow}>
              <span>Usage when limit reached</span>
              <span>Allowed</span>
            </div>
          )}
          {overageAllowedWithExhaustedQuota && (
            <div className={styles.tooltipRow}>
              <span>Excess when limit reached</span>
              <span>Allowed</span>
            </div>
          )}
        </div>

        {lastRefreshLabel && (
          <>
            <div className={styles.tooltipDivider} />
            <div className={styles.tooltipFooter}>
              Refreshed at {lastRefreshLabel}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container} ref={containerRef}>
      <div
        className={styles.trigger}
        onClick={handleBarClick}
        role="button"
        tabIndex={0}
        aria-label="Copilot quota"
      >
        {renderBar()}
      </div>
      {tooltipOpen && renderTooltip()}
    </div>
  );
}
