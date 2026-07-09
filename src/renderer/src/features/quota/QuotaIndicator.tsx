import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@renderer/services/api';
import type { CopilotQuotaSnapshot } from '@shared/types/quota';
import styles from './QuotaIndicator.module.css';

const QUOTA_TYPE = 'premium_interactions';
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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

export default function QuotaIndicator() {
  const [state, setState] = useState<QuotaState>({ status: 'loading' });
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastRefreshedRef = useRef<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetchQuota = useCallback(async (isRefresh = false) => {
    // On manual refresh, keep showing the current snapshot
    if (isRefresh && (state.status === 'loaded' || state.status === 'refreshing')) {
      const prev = state.status === 'loaded' ? state.snapshot : state.snapshot;
      setState({ status: 'refreshing', snapshot: prev });
    } else if (!isRefresh) {
      setState({ status: 'loading' });
    }

    try {
      const data = await api.getCopilotQuota();
      if (!mountedRef.current) return;

      const snapshot = data.quotaSnapshots[QUOTA_TYPE];
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

      setState({ status: 'loaded', snapshot });
      lastRefreshedRef.current = new Date();
    } catch (err) {
      if (!mountedRef.current) return;
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err)
      });
    }
  }, [state.status]);

  // Initial fetch + polling (runs once on mount)
  useEffect(() => {
    mountedRef.current = true;
    fetchQuota();

    intervalRef.current = setInterval(() => fetchQuota(), REFRESH_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    fetchQuota(true);
  }, [fetchQuota]);

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

  const renderBar = () => {
    const snapshot = getSnapshot();

    switch (state.status) {
      case 'loading':
        return (
          <div className={`${styles.bar} ${styles.loading}`}>
            <span className={styles.label}>…</span>
          </div>
        );

      case 'error':
        return (
          <div className={`${styles.bar} ${styles.error}`}>
            <span className={styles.label}>Err</span>
          </div>
        );

      case 'not-available':
        return (
          <div className={`${styles.bar} ${styles.na}`}>
            <span className={styles.label}>N/A</span>
          </div>
        );

      case 'unlimited':
        return (
          <div className={`${styles.bar} ${styles.green}`}>
            <div className={styles.fill} style={{ width: '100%' }} />
            <span className={styles.label}>∞</span>
          </div>
        );

      case 'refreshing':
      case 'loaded': {
        if (!snapshot) return null;
        const { usedRequests, entitlementRequests } = snapshot;
        const consumedPct = entitlementRequests > 0
          ? Math.min(100, Math.round((usedRequests / entitlementRequests) * 100))
          : 0;
        const fillClass = consumedColorClass(consumedPct);
        return (
          <div
            className={`${styles.bar} ${fillClass} ${state.status === 'refreshing' ? styles.refreshing : ''}`}
          >
            <div className={styles.fill} style={{ width: `${consumedPct}%` }} />
            <span className={styles.label}>
              {formatNumber(usedRequests)} / {formatNumber(entitlementRequests)} ({consumedPct}%)
            </span>
          </div>
        );
      }
    }
  };

  const renderTooltip = () => {
    const snapshot = getSnapshot();
    if (!snapshot) return null;

    const {
      usedRequests,
      entitlementRequests,
      overage,
      usageAllowedWithExhaustedQuota,
      overageAllowedWithExhaustedQuota
    } = snapshot;

    const consumedPct = entitlementRequests > 0
      ? Math.round((usedRequests / entitlementRequests) * 100)
      : 0;
    const remaining = entitlementRequests > 0
      ? entitlementRequests - usedRequests
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
          <div className={styles.tooltipBar}>
            <div
              className={styles.tooltipBarFill}
              style={{ width: `${consumedPct}%` }}
            />
          </div>
          <div className={styles.tooltipBarLabels}>
            <span>{consumedPct}% consumed</span>
            <span>{remaining.toLocaleString()} remaining</span>
          </div>
        </div>

        {(overage > 0 || usageAllowedWithExhaustedQuota || overageAllowedWithExhaustedQuota) && (
          <div className={styles.tooltipDivider} />
        )}

        <div className={styles.tooltipDetails}>
          {overage > 0 && (
            <div className={styles.tooltipRow}>
              <span>Overage</span>
              <span>{overage.toLocaleString()}</span>
            </div>
          )}
          {usageAllowedWithExhaustedQuota && (
            <div className={styles.tooltipRow}>
              <span>Usage after exhaustion</span>
              <span>Allowed</span>
            </div>
          )}
          {overageAllowedWithExhaustedQuota && (
            <div className={styles.tooltipRow}>
              <span>Overage after exhaustion</span>
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
      <button
        className={styles.trigger}
        onClick={handleBarClick}
        aria-label="Copilot quota"
      >
        {renderBar()}
      </button>
      <button
        className={`${styles.refreshBtn} ${isLoading ? styles.spinning : ''}`}
        onClick={handleRefresh}
        aria-label="Refresh quota"
      >
        <i className="fa-solid fa-rotate-right" aria-hidden="true" />
      </button>
      {tooltipOpen && renderTooltip()}
    </div>
  );
}
